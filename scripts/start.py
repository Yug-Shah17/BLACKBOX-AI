"""Start the existing web frontend and single-worker local API together."""

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def validate_environment():
    if not (ROOT / "ml" / "models" / "step_ranker.joblib").is_file():
        raise SystemExit("Model missing. Run the setup instructions in README.md first.")
    if not (ROOT / "ml" / "outputs" / "metrics.json").is_file():
        raise SystemExit("Metrics missing. Run python -m ml.train_model first.")
    if not (ROOT / "frontend" / "node_modules" / "next" / "dist" / "bin" / "next").is_file():
        raise SystemExit("Frontend dependencies missing. Run npm ci inside frontend first.")
    if shutil.which("node") is None:
        raise SystemExit("Node.js is missing from PATH.")


def free_port(port):
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError as error:
            raise SystemExit(f"Port {port} is occupied. Stop its server or choose another port.") from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-port", type=int, default=8000)
    parser.add_argument("--frontend-port", type=int, default=3000)
    parser.add_argument("--check", action="store_true", help="Check files/tools without launching services")
    args = parser.parse_args()
    validate_environment()
    if args.check:
        print("Startup files and Node.js are available. Use scripts/check.py for model/API verification.")
        return
    if not 1 <= args.backend_port <= 65535 or not 1 <= args.frontend_port <= 65535:
        parser.error("Ports must be between 1 and 65535")
    if args.backend_port == args.frontend_port:
        parser.error("Frontend and backend ports must differ")
    for port in (args.backend_port, args.frontend_port):
        free_port(port)
    environment = {**os.environ, "BACKEND_URL": f"http://127.0.0.1:{args.backend_port}",
                   "NEXT_TELEMETRY_DISABLED": "1"}
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    children = []
    try:
        children.append(subprocess.Popen([sys.executable, "-B", "-m", "uvicorn", "backend.app.main:app",
                                          "--host", "127.0.0.1", "--port", str(args.backend_port),
                                          "--workers", "1"], cwd=ROOT, env=environment, creationflags=flags))
        children.append(subprocess.Popen([shutil.which("node"), "node_modules/next/dist/bin/next", "dev",
                                          "--hostname", "127.0.0.1", "--port", str(args.frontend_port)],
                                         cwd=ROOT / "frontend", env=environment, creationflags=flags))
        print(f"UI: http://127.0.0.1:{args.frontend_port}/runs", flush=True)
        print(f"API: http://127.0.0.1:{args.backend_port}/docs", flush=True)
        print("Press Ctrl+C to stop both services.", flush=True)
        while all(child.poll() is None for child in children):
            time.sleep(0.5)
        raise SystemExit("A service stopped. Check the server output above.")
    except KeyboardInterrupt:
        print("Stopping local services.")
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == "__main__":
    main()
