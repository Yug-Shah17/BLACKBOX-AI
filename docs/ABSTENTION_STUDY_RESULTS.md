# Lexical abstention study: rejected candidate

This offline experiment did **not** meet its pre-registered acceptance criteria. No product retrieval behavior changed. A threshold that retained at least 95% of correctly retrieved calibration positives could not improve abstention: calibration selected threshold 0, meaning no filtering.

## Frozen protocol and provenance

- Plan: d5f5ff6, before corpus/evaluation.
- Corpus: 2fb55ce, before any scores. Separate agent authored 8 fictional sources and 40 questions per split: 20 supported, 10 incidental-overlap negatives, 10 topical missing-detail negatives. Documents/topics are disjoint between calibration and holdout. This is agent-authored synthetic data, not human annotation, semantic answer validation or evidence of real-world accuracy.
- Algorithm and selected threshold: 6f8b342, committed before the first holdout score. No threshold retuning or query rewriting followed the holdout.
- Fixture SHA256: `b1d51439900845fdae907620664c5d7cff629d6b5ce98f4f8443deb52075f0b7`.
- Original development/review fixtures and v2/v3 reports remain unchanged. The earlier v3 review's unsupported abstention 0/4 remains valid for that separate set; denominators must not be pooled into an accuracy claim.

The gate uses the fraction of distinct normalized content-query tokens covered by the top current source, weighted by document-collection IDF. It retains v3 ranking when coverage meets the threshold, otherwise abstains completely. IDF=1+ln((N+1)/(df+1)); normalization and stopwords are existing v3 behavior. It tests lexical overlap, not whether text actually answers a question. See ABSTENTION_STUDY_PLAN.md for the full formula and acceptance rule.

## Calibration tradeoff

| Threshold | Retained v3-correct positives / 20 | Unsupported abstentions / 20 | Eligible (>=95% retention) |
|---|---:|---:|---|
| 0 | 20 | 0 | Yes |
| 0.25 | 15 | 9 | No |
| 0.5 | 6 | 19 | No |
| 0.75 | 1 | 20 | No |
| 1 | 1 | 20 | No |

Threshold 0.25 rejected 9 unsupported questions but also lost 5 supported questions; threshold 0.5 rejected 19 unsupported questions but lost 14 supported questions. These are calibration outcomes, not tested alternative holdout claims. Selecting an aggressive threshold would hide positive retrieval regressions. The predetermined selection rule chose 0.

## Holdout, evaluated after selection freeze

| Measure | v3 baseline | Selected gate (threshold 0) |
|---|---:|---:|
| Supported top-1 | 20/20 | 20/20 |
| MRR | 1.000 | 1.000 |
| Mean Recall@3 | 0.975 | 0.975 |
| Unsupported abstention | 1/20 | 1/20 |
| Retention of baseline-correct positives | — | 20/20 |

Acceptance: **failed** because unsupported abstention did not strictly improve. Baseline/candidate predictions are identical. No runtime adoption, new workflow version, frontend parity change, dependency or provider call is part of this study.

High ranking on these supported synthetic questions does not address unsupported questions. Matching words can locate a topically related source that lacks the requested detail; simple coverage also penalizes valid paraphrases and extra question words. A larger/different benchmark and a better method would be needed before considering another gate. This report does not justify an embeddings/LLM superiority claim either.

## Label audit caveat

An independent code/data review found one debatable positive label: `hold-p2`, “Can a nonmember borrow the cart?”, points to `hold-d1`, which describes club members borrowing the cart without explicitly stating nonmember eligibility. The frozen relevance label and raw results are preserved. Therefore **20/20 means agreement with frozen synthetic relevance labels**, not proof that all 20 questions have an answer in the sources. This caveat does not rescue the failed abstention experiment or justify tuning against this holdout.

## Every holdout failure

All 19 failures are unsupported queries that still retrieve a source; no supported top-1 loss occurred. Full rankings and coverage are saved in ml/abstention_study_holdout.json. No failures were removed or tuned away.

| Query | Category | Question | First retrieved source | Coverage |
|---|---|---|---|---:|
| hold-n1 | incidental-keyword-overlap | What grade is maple syrup? | Maple archive cart | 0.281 |
| hold-n2 | incidental-keyword-overlap | How fast can a kestrel fly? | Kestrel pottery kiln | 0.281 |
| hold-n3 | incidental-keyword-overlap | What is copper's melting point? | Copper refill station | 0.220 |
| hold-n4 | incidental-keyword-overlap | How should I water a fern houseplant? | Copper refill station | 0.305 |
| hold-n5 | incidental-keyword-overlap | Where is the oldest ancient mosaic? | Mosaic repair table | 0.281 |
| hold-n6 | incidental-keyword-overlap | Where was the movie Dune filmed? | Dune game cabinet | 0.207 |
| hold-n7 | incidental-keyword-overlap | How can I identify birch bark? | Birch compost bay | 0.281 |
| hold-n8 | incidental-keyword-overlap | How much saffron goes into rice? | Saffron display wall | 0.164 |
| hold-n10 | incidental-keyword-overlap | How do I replace a keyboard circuit board? | Dune game cabinet | 0.159 |
| hold-n11 | topical-missing-detail | What does Maple charge per scan? | Maple archive cart | 0.207 |
| hold-n12 | topical-missing-detail | What resolution does the cart scanner support? | Maple archive cart | 0.439 |
| hold-n13 | topical-missing-detail | At what temperature does Kestrel fire pottery? | Kestrel pottery kiln | 0.439 |
| hold-n14 | topical-missing-detail | Who pays if a pot cracks during firing? | Kestrel pottery kiln | 0.141 |
| hold-n15 | topical-missing-detail | When was Copper's water last tested? | Copper refill station | 0.293 |
| hold-n16 | topical-missing-detail | Can wheelchair users board the Fern shuttle? | Fern shuttle loop | 0.516 |
| hold-n17 | topical-missing-detail | How long is the shuttle trip? | Fern shuttle loop | 0.281 |
| hold-n18 | topical-missing-detail | Do I need a Mosaic repair appointment? | Mosaic repair table | 0.439 |
| hold-n19 | topical-missing-detail | What is the fine for an overdue Dune game? | Dune game cabinet | 0.439 |
| hold-n20 | topical-missing-detail | How does Saffron select artworks? | Saffron display wall | 0.281 |

## Reproduce offline

From the repository root with existing requirements installed:

```powershell
python -B -m unittest ml.test_abstention_study
python -B -m ml.abstention_study calibrate --output ml/abstention_study_selection.json
python -B -m ml.abstention_study holdout --output ml/abstention_study_holdout.json
```

The holdout command checks the saved selection's fixture hash and threshold grid before scoring. A separate fresh-process reproduction produced identical holdout JSON SHA256 `908fbf64d577809ceb1ac014beb97ff8dcec209d5c15401d2fdce2939e0cfdf3`. This is a reproducibility check of the frozen method, not another model-selection pass. Three targeted policy/metric tests passed. No external service is needed.

Interview explanation: “I tested a simple abstention filter, predeclared how I would choose its threshold, and froze it before scoring separate synthetic questions. Useful filtering rejected too many supported questions, so I kept the working retriever and published the negative result instead of claiming an improvement.”
