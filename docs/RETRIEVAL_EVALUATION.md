# Offline document retrieval evaluation

This evaluates source retrieval in the local document workflow, **not** answer quality, semantic understanding, the failure diagnosis model, or Gemini. No network request, provider, training or paid API is involved.

## Reproduce

From the repository root, with the existing requirements installed:

```powershell
python -m ml.evaluate_retrieval --version document-qa-v2 --output ml/retrieval_baseline.json
python -m ml.evaluate_retrieval --output ml/retrieval_improved.json
python -m unittest backend.tests.test_retrieval
```

The JSON files include every ranked result and relevance label. The first baseline was measured and committed in `482c88a` before ranking changes. Its `retrieve` wrapper was behaviorally identical to the original topic-overlap comprehension. Both versions remain executable for paired comparisons.

## Dataset and protocol

`ml/retrieval_cases.json` contains 12 short synthetic documents (11 current, one archived) and 20 hand-authored queries. Topics include policies, delivery, financial support, campus services, account access, examinations, safety, leave and tuition. Labels and development/challenge membership were saved before the ranking change. Six development and eleven challenge queries have at least one relevant current source; three queries have no relevant source. Two ambiguous queries accept either of two labeled sources. Paraphrase and missing-detail cases deliberately expose limitations.

Both versions receive identical source order, questions, and text. No query-specific aliases, per-case rules, extra dependencies or learned parameters were added. The challenge split is a reproducible stress subset, **not an independent held-out benchmark**: the same developer authored and could inspect it. These small, clean synthetic documents are much easier than long, noisy real uploads. No broad accuracy claim follows.

Metrics use the ranking after archived sources are skipped, matching normal selection behavior. Archived sources remain present in actual retrieval output so the deliberately wrong-source demonstration and checkpoint correction still work. Top-1 counts a hit if the first current source belongs to the label set. MRR averages reciprocal first relevant rank (zero when missing). Recall@3 averages the fraction of each query's labeled sources found in the first three current results. Negative queries are excluded from these three metrics and reported separately as correct empty retrievals. Empty retrieval is a source-retrieval abstention, not a generated natural-language refusal.

## Paired results

| Subset | Positive / negative queries | Top-1 before → after | MRR before → after | Mean Recall@3 before → after | Negative abstentions before → after |
|---|---:|---:|---:|---:|---:|
| All | 17 / 3 | 4/17 → 15/17 | 0.2647 → 0.8824 | 0.2941 → 0.8824 | 3/3 → 3/3 |
| Development | 6 / 2 | 2/6 → 6/6 | 0.4167 → 1.0000 | 0.5000 → 1.0000 | 2/2 → 2/2 |
| Challenge | 11 / 1 | 2/11 → 9/11 | 0.1818 → 0.8182 | 0.1818 → 0.8182 | 1/1 → 1/1 |

## What changed

v2 returned documents in supplied order if any question word matched the topic. A generic word such as “policy” could therefore select privacy before returns. Words present only in a title or source body were invisible.

v3 applies NFKC compatibility normalization, lowercases, equates ß with ss and final sigma with sigma, removes a small fixed list of common question words, and tokenizes Unicode words. This explicit normalization is shared with frontend correction suggestions; it is not a claim of exhaustive Unicode case folding. It scores exact overlap against title/topic (weight 2 per matching token) and text (weight 1). Nonzero candidates are sorted by score; ties retain supplied order. Normal selection still chooses the first current source. This is a transparent lexical heuristic, not embeddings, BM25, a trained retriever or an LLM. Source count and text bounds already limit work; no index service is needed for the maximum 30 supplied documents.

Fresh local runs use `document-qa-v3`. Recorded v1/v2 checkpoints retain their original retrieval and relevance checks; Gemini and explicit word-count paths retain their previous behavior. Route fields and output shapes are unchanged.

## Failures and limits

- Both versions miss c11, “recover my login credentials”: the source says “reset” and “password”, with no shared content token. There is no synonym or semantic matching.
- Both miss c12, “return damaged purchases”: “return” does not exactly match “returns”. Even retrieving the returns source would not prove the answer about damaged purchases; the source lacks that detail.
- Three easy negatives all abstain, but this does not establish robust unsupported-question detection. A question sharing a broad word like “policy” can retrieve irrelevant evidence. The local validator checks lexical relevance and exact output integrity, not whether the document answers every part of a question.
- Ambiguous queries accept more than one source and stable ties depend on supplied order. The app does not ask a disambiguation question.
- Long documents with incidental keyword matches, typos, multilingual inflections, contradictory current documents and adversarial inputs need a larger independently authored evaluation. Results do not justify a production retrieval-quality claim.
- Local generation returns the selected document text (or an explicit word count). Retrieval success must never be presented as answer correctness or trained ML improvement.

## Separately authored review

A second frozen, separately agent-authored synthetic corpus improves supported-query top-1 from 7/12 to 12/12 but worsens correct negative-query abstention from 3/4 to 0/4. This demonstrates why the original three easy negatives cannot establish question-answerability. See the [review protocol and complete results](RETRIEVAL_REVIEW_PROTOCOL.md); no retrieval tuning or fixture edits followed those scores.
