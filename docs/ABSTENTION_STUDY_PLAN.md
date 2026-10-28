# Offline retrieval abstention experiment plan

Scope: offline only; no production workflow, frontend correction, API, dependency, v2/v3 implementation or existing frozen report changes. Goal: measure a simple lexical coverage filter's tradeoff honestly, not claim semantic answerability.

Protocol, frozen before scores: separately authored calibration and holdout sets, each 20 supported +20 unsupported questions, with disjoint documents/topics across splits. Include supported paraphrases, ambiguous supported questions, incidental lexical overlap negatives, and strong overlap questions asking details absent from text. Agent-authored synthetic data must be labeled as such, not human/independent validation.

Candidate: retain v3 ranking; for its first current candidate measure IDF-weighted fraction of distinct normalized content query tokens present in title/topic/text. IDF=1+ln((N+1)/(df+1)), N is the supplied document collection size; normalization/stopwords match existing v3. Zero-content-token coverage=0. Threshold grid [0,0.25,0.5,0.75,1]. Keep top candidate if coverage>=threshold; otherwise abstain. Coverage is lexical support, not an answerability score. Count/Gemini paths out of scope.

Select threshold on calibration only: maximum unsupported abstentions subject to retaining >=95% of v3's correctly top-ranked supported cases; ties choose smallest threshold. Freeze selected threshold before first holdout score. Evaluate holdout once; no retuning or query rewriting after results. Existing original and review corpora remain untouched and are not calibration.

Report v3 and filtered top1 numerator/denominator, positive retention/losses, negative abstentions, MRR and Recall@3, and every false abstention or unsupported retrieval. Reproducible command, fixture SHA256 and freeze commit. Baseline denominator-zero cases explicitly undefined. Gate filters complete ranked list when top current candidate fails, otherwise list unchanged.

Acceptance to consider future application: strictly improve holdout negative abstention and retain >=95% of v3 correct positive top1s. Even if passing, NO runtime integration in this experiment. Further product adoption requires separately versioned workflow, backend/frontend replay parity and validation. A failed tradeoff is a valid report; do not tune away failures.

Ownership: corpus author owns only ml/abstention_study_cases.json in this worktree until its freeze commit. Coordinator then owns experiment script/results/docs. No concurrent edits to same files.
