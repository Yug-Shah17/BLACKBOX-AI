# Blind synthetic retrieval review protocol

This fixture was authored independently by a separate fresh-context AI agent before coordinator evaluation. The author was instructed not to inspect retrieval implementation, existing fixtures, metrics, or scores, and did not run retrieval or tune against results. The eight organizations and their policy/support passages are fictional. This is synthetic review evidence, not human-authored or external validation, and supports no model or performance claim on its own.

The fixture has eight source documents, including one explicitly archived contradictory policy, and sixteen review queries. Twelve queries have positive relevance labels; two of these intentionally allow multiple current sources. Four queries have no supporting source; two use strong lexical overlap while asking for details that the matching documents explicitly do not supply. The questions mix literal wording, paraphrase, synonyms, numbers, a policy effective date, multiple requirements, singular wording, and a typo. No query aliases are provided.

A positive label means the source actually supports the requested fact or procedure. Similar subject matter alone is insufficient. Archived instructions are not valid answers to current-policy questions. Ambiguous questions accept either listed current source, provided the answer preserves the source's conditions. Empty relevance lists mean the corpus cannot supply the requested answer and retrieval should permit abstention. Review split membership is fixed for every query.

Freeze this fixture in a Git commit before any coordinator evaluation. Record the fixture commit with evaluation results. Do not alter the documents, questions, labels, or split after inspecting scores. Any later corpus revision must be a separately versioned study and must not be represented as this blind review. Report results separately from pre-existing development fixtures, identify the synthetic provenance, and disclose that this small sample cannot establish broad generalization or production readiness.

## Frozen review results (26 October 2026)

The separately authored corpus was frozen in commit `52e5fdb192a482f80b2b49135877e7a570b84ff4` before either retriever was run. No retrieval implementation was changed after seeing these results. Both versions used the same supplied order and current-source filtering, with the same metrics as the original evaluation.

| Metric | Original v2 | Current v3 |
|---|---:|---:|
| First relevant current source, supported questions | 7/12 | 12/12 |
| Mean reciprocal rank, supported questions | 0.5833 | 1.0000 |
| Mean recall@3, supported questions | 0.5417 | 1.0000 |
| Correct empty retrieval, unsupported questions | 3/4 | 0/4 |

**The wider lexical matching improves source ranking here but worsens unsupported-question abstention.** All four unsupported questions retrieve a source in v3. A retrieved passage and passing source-integrity check do not establish that the passage answers the requested detail. This is a limitation of the current prototype, not a hidden success or a reason to tune this frozen set. The twelve supported questions and four negatives are reported separately; there is no combined answer-accuracy score.

The review set was independently *agent-authored*, not authored by independent humans or collected from real users. Its short fictional passages and small sample are insufficient for real-world reliability claims. Earlier development results remain separate.

Reproduce from the repository root:

```powershell
python -m ml.evaluate_retrieval --version document-qa-v2 --fixture ml/retrieval_review_cases.json --output ml/retrieval_review_baseline.json
python -m ml.evaluate_retrieval --fixture ml/retrieval_review_cases.json --output ml/retrieval_review_improved.json
python -m unittest backend.tests.test_retrieval
```

Both JSON reports include every question, relevance label and ranked result. Regression checks reproduce the checked-in reports. No provider calls, training, dependency additions or fixture edits were used to obtain these numbers.
