"""Reproducible, offline retrieval evaluation; no provider or generation calls."""

import argparse
import json
from pathlib import Path

from backend.app.services import documents


def evaluate(version: str, fixture_path: Path | None = None) -> dict:
    if version not in (documents.LEGACY_VERSION, documents.PREVIOUS_VERSION, documents.VERSION, documents.GEMINI_VERSION):
        raise ValueError("Unsupported recorded retrieval version")
    fixture = json.loads((fixture_path or Path(__file__).with_name("retrieval_cases.json")).read_text(encoding="utf-8-sig"))
    rows = []
    for query in fixture["queries"]:
        # Selection skips archived sources, so evaluate the same current-source ranking.
        ranked = [key for key in documents.retrieve(query["question"], fixture["documents"], version)
                  if next(item for item in fixture["documents"] if item["documentId"] == key)["current"]]
        expected = set(query["relevant"])
        rank = next((index + 1 for index, key in enumerate(ranked) if key in expected), None)
        rows.append({**query, "retrieved": ranked, "firstRelevantRank": rank,
                     "top1": bool(ranked and ranked[0] in expected),
                     "reciprocalRank": 1 / rank if rank else 0,
                     "recallAt3": len(expected.intersection(ranked[:3])) / len(expected) if expected else None,
                     "correctAbstention": not ranked if not expected else None})
    summary = {}
    for split in ("all", *dict.fromkeys(row["split"] for row in rows)):
        selected = [row for row in rows if split == "all" or row["split"] == split]
        positive = [row for row in selected if row["relevant"]]
        negative = [row for row in selected if not row["relevant"]]
        summary[split] = {"answerableQueries": len(positive), "negativeQueries": len(negative),
                          "top1Hits": sum(row["top1"] for row in positive),
                          "mrr": round(sum(row["reciprocalRank"] for row in positive) / len(positive), 4) if positive else None,
                          "meanRecallAt3": round(sum(row["recallAt3"] for row in positive) / len(positive), 4) if positive else None,
                          "correctAbstentions": sum(row["correctAbstention"] for row in negative)}
    return {"workflowVersion": version, "summary": summary, "queries": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=documents.VERSION)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--fixture", type=Path, help="Frozen source/query fixture; defaults to the original development corpus")
    args = parser.parse_args()
    result = json.dumps(evaluate(args.version, args.fixture), indent=2) + "\n"
    if args.output:
        args.output.write_text(result, encoding="utf-8")
    print(result)
