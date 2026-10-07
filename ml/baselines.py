"""Transparent comparators for the bounded arithmetic workflow."""

from ml.features import step_features


def last_error(run):
    errors = [step["stepId"] for step in run["steps"] if step["status"] == "error"]
    return errors[-1:] if errors else []


def first_local_evidence(run):
    # Prefer the earliest direct inconsistency, not its downstream symptoms.
    return [step["stepId"] for step in run["steps"]
            if (features := step_features(step)[0])["explicitError"]
            or features["localMismatch"]]
