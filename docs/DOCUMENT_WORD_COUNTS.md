# Local Word Counts

New document executions recognize explicit single-word frequency questions such as:

- `How many times was the word Integrity repeated?`
- `How often is the word integrity mentioned?`
- `Count occurrences of "integrity".`

The operation counts case-insensitive, whole-word matches in the selected document's extracted text. Punctuation separates words; substrings inside longer words do not count. A zero count is a valid answer. This is a deterministic operation, not an LLM or general natural-language question-answering engine. Other questions retain the existing extractive demonstration behavior.

Frequency queries retrieve supplied documents independent of topic keywords, then use the existing current-source selection step. With multiple current documents, the first retrieved current document is selected. Counts are not silently aggregated across files. The answer explicitly states its selected-document scope and cites that document. Archived selection remains invalid.

Generation records the expected computed answer for checkpoint inspection and replacement suggestions. The validator and diagnosis recompute the expected answer from recorded source text rather than accepting a full source copy as a successful count. Deliberate wrong answers and citations remain detectable.

New runs use `document-qa-v2`. Existing `document-qa-v1` records and replay branches retain their original extractive semantics. Re-execute an old question as a new run to use word counts; historical records are not rewritten.
