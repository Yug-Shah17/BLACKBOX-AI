"""Atomic local persistence, synchronized for a single Uvicorn worker."""

import copy
import json
import math
import os
import tempfile
import threading
from pathlib import Path

from backend.app.schemas import AgentRun


class StorageError(Exception):
    pass


def _finite_number(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Non-finite numbers are not valid persisted data")
    return number


class RunStore:
    def __init__(self, directory, fixture_path=None):
        self.directory = Path(directory)
        self.path = self.directory / "state.json"
        self.fixture_path = Path(fixture_path) if fixture_path else None
        self.lock = threading.RLock()

    def _read(self):
        try:
            if self.path.exists():
                state = json.loads(self.path.read_text(encoding="utf-8"),
                                   parse_float=_finite_number, parse_constant=_finite_number)
                if not isinstance(state, dict) or state.get("version") != 1:
                    raise ValueError("Unsupported state")
                if not isinstance(state.get("runs"), dict) or not isinstance(state.get("checkpoints"), dict):
                    raise ValueError("Invalid store")
                for identifier, record in state["runs"].items():
                    if (not isinstance(record, dict) or not isinstance(record.get("public"), dict)
                            or record["public"].get("runId") != identifier):
                        raise ValueError("Invalid stored run record")
                    AgentRun.model_validate(record["public"])
                if any(not isinstance(snapshot, dict) for snapshot in state["checkpoints"].values()):
                    raise ValueError("Invalid stored checkpoint record")
                return state
            state = {"version": 1, "runs": {}, "checkpoints": {}}
            if self.fixture_path and self.fixture_path.exists():
                fixtures = json.loads(self.fixture_path.read_text(encoding="utf-8"),
                                     parse_float=_finite_number, parse_constant=_finite_number)
                if not isinstance(fixtures, list):
                    raise ValueError("Invalid fixtures")
                for item in fixtures:
                    public = AgentRun.model_validate(item).model_dump()
                    state["runs"][public["runId"]] = {"public": public, "observed": None}
            return state
        except (OSError, ValueError, TypeError, KeyError) as error:
            raise StorageError("Stored run data is unreadable or corrupt") from error

    def _write(self, state):
        temporary = None
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.directory,
                                             prefix="state-", suffix=".tmp", delete=False) as stream:
                temporary = Path(stream.name)
                json.dump(state, stream, allow_nan=False)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.path)
        except (OSError, ValueError) as error:
            raise StorageError("Could not persist run data") from error
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink(missing_ok=True)

    def list_runs(self):
        with self.lock:
            return [copy.deepcopy(item["public"]) for item in self._read()["runs"].values()]

    def get(self, run_id):
        with self.lock:
            record = self._read()["runs"].get(run_id)
            return copy.deepcopy(record) if record else None

    def checkpoint(self, checkpoint_id):
        with self.lock:
            value = self._read()["checkpoints"].get(checkpoint_id)
            return copy.deepcopy(value) if value else None

    def save(self, record, checkpoints):
        with self.lock:
            state = self._read()
            identifier = record["public"]["runId"]
            if identifier in state["runs"]:
                raise StorageError("Run identifier already exists")
            state["runs"][identifier] = copy.deepcopy(record)
            state["checkpoints"].update(copy.deepcopy(checkpoints))
            self._write(state)
