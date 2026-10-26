"""Offline lexical coverage experiment; never changes a recorded workflow."""

import argparse
import hashlib
import json
import math
from pathlib import Path

from backend.app.services import documents

GRID = (0, 0.25, 0.5, 0.75, 1)


def load_fixture(path: Path) -> tuple[dict, str]:
    raw = path.read_bytes()
    fixture = json.loads(raw.decode("utf-8-sig"))
    seen_documents, seen_queries = set(), set()
    for split_name in ("calibration", "holdout"):
        split = fixture["splits"][split_name]
        sources = [documents.Document.model_validate(item).model_dump() for item in split["documents"]]
        ids = {item["documentId"] for item in sources}
        if len(ids) != len(sources) or ids & seen_documents or not all(item["current"] for item in sources):
            raise ValueError("Study sources must be unique, current and disjoint between splits")
        seen_documents.update(ids)
        counts = {"positive": 0, "negative": 0}
        for query in split["queries"]:
            expected = query["expectedDocumentIds"]
            if (query["id"] in seen_queries or query["slice"] not in counts
                    or not isinstance(query["question"], str) or not query["question"].strip()
                    or documents.word_count_target(query["question"]) is not None
                    or not isinstance(expected, list) or not set(expected) <= ids
                    or bool(expected) != (query["slice"] == "positive")):
                raise ValueError("Invalid, duplicate, counting or mislabeled study query")
            counts[query["slice"]] += 1
            seen_queries.add(query["id"])
        if counts != {"positive": 20, "negative": 20}:
            raise ValueError("Each split requires exactly 20 positives and 20 negatives")
    return fixture, hashlib.sha256(raw).hexdigest()


def coverage(question: str, candidate: dict, sources: list[dict]) -> float:
    query = documents.retrieval_tokens(question)
    if not query:
        return 0.0
    tokens = [documents.retrieval_tokens(" ".join(item[key] for key in ("title", "topic", "text")))
              for item in sources]
    weights = {word: 1 + math.log((len(sources) + 1) / (sum(word in text for text in tokens) + 1))
               for word in query}
    present = documents.retrieval_tokens(" ".join(candidate[key] for key in ("title", "topic", "text")))
    return sum(weights[word] for word in query & present) / sum(weights.values())


def score_split(split: dict, threshold: float) -> list[dict]:
    sources = split["documents"]
    by_id = {item["documentId"]: item for item in sources}
    rows = []
    for query in split["queries"]:
        baseline = [key for key in documents.retrieve(query["question"], sources, documents.VERSION)
                    if by_id[key]["current"]]
        fraction = coverage(query["question"], by_id[baseline[0]], sources) if baseline else 0.0
        candidate = baseline if baseline and fraction >= threshold else []
        rows.append({**query, "coverage": fraction, "baseline": baseline, "candidate": candidate})
    return rows


def summary(rows: list[dict], method: str) -> dict:
    positive = [row for row in rows if row["expectedDocumentIds"]]
    negative = [row for row in rows if not row["expectedDocumentIds"]]
    hits, reciprocal, recall = 0, 0.0, 0.0
    for row in positive:
        ranked, expected = row[method], set(row["expectedDocumentIds"])
        hits += bool(ranked and ranked[0] in expected)
        rank = next((i + 1 for i, key in enumerate(ranked) if key in expected), None)
        reciprocal += 1 / rank if rank else 0
        recall += len(expected.intersection(ranked[:3])) / len(expected)
    return {"positiveQueries": len(positive), "negativeQueries": len(negative), "top1Hits": hits,
            "mrr": reciprocal / len(positive) if positive else None,
            "meanRecallAt3": recall / len(positive) if positive else None,
            "negativeAbstentions": sum(not row[method] for row in negative)}


def positive_retention(rows: list[dict]) -> tuple[int, int]:
    correct = [row for row in rows if row["baseline"]
               and row["baseline"][0] in row["expectedDocumentIds"]]
    retained = sum(bool(row["candidate"] and row["candidate"][0] in row["expectedDocumentIds"])
                   for row in correct)
    return retained, len(correct)


def calibrate(split: dict) -> dict:
    grid = []
    for threshold in GRID:
        rows = score_split(split, threshold)
        retained, correct = positive_retention(rows)
        result = summary(rows, "candidate")
        grid.append({"threshold": threshold, "retainedCorrectPositives": retained,
                     "baselineCorrectPositives": correct,
                     "eligible": bool(correct and retained / correct >= 0.95), **result})
    eligible = [item for item in grid if item["eligible"]]
    if not eligible:
        raise ValueError("No eligible threshold; positive retention is undefined or below constraint")
    selected = max(eligible, key=lambda item: (item["negativeAbstentions"], -item["threshold"]))
    return {"selectedThreshold": selected["threshold"], "grid": grid}


def evaluate_holdout(split: dict, threshold: float) -> dict:
    rows = score_split(split, threshold)
    baseline, candidate = summary(rows, "baseline"), summary(rows, "candidate")
    retained, correct = positive_retention(rows)
    failures = [row["id"] for row in rows if
                (not row["expectedDocumentIds"] and row["candidate"])
                or (row["expectedDocumentIds"] and
                    (not row["candidate"] or row["candidate"][0] not in row["expectedDocumentIds"]))]
    return {"baseline": baseline, "candidate": candidate,
            "retainedCorrectPositives": retained, "baselineCorrectPositives": correct,
            "positiveRetention": retained / correct if correct else None,
            "acceptancePassed": bool(correct and retained / correct >= 0.95
                                     and candidate["negativeAbstentions"] > baseline["negativeAbstentions"]),
            "failureQueryIds": failures, "queries": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("calibrate", "holdout"))
    parser.add_argument("--fixture", type=Path, default=Path(__file__).with_name("abstention_study_cases.json"))
    parser.add_argument("--selection", type=Path, default=Path(__file__).with_name("abstention_study_selection.json"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    fixture, sha = load_fixture(args.fixture)
    if args.phase == "calibrate":
        result = {"fixtureSha256": sha, "workflowVersion": documents.VERSION,
                  **calibrate(fixture["splits"]["calibration"])}
    else:
        selection = json.loads(args.selection.read_text(encoding="utf-8"))
        if selection["fixtureSha256"] != sha or selection["selectedThreshold"] not in GRID:
            raise ValueError("Selection does not match frozen fixture or pre-registered grid")
        result = {"fixtureSha256": sha, "workflowVersion": documents.VERSION,
                  "selectedThreshold": selection["selectedThreshold"],
                  **evaluate_holdout(fixture["splits"]["holdout"], selection["selectedThreshold"])}
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key not in ("queries", "grid")}, indent=2))
