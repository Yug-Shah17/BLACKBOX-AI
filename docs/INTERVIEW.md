# CV and Interview Guide

## Accurate Project Description

Black Box: a full-stack agent-debugging prototype with synthetic trace generation,
learned step ranking, checkpoint replay, persisted branches, and execution comparison.

It also includes a controlled extractive document workflow with fictional
registration, eligibility, and submission sources. Document diagnosis is
rule-based and separate from the learned arithmetic ranker.

Possible CV bullets, after you understand the implementation and accurately
describe your own role:

- Developed an AI-assisted debugging prototype with a FastAPI backend and
  Next.js interface for trace inspection, checkpoint replay, and branch comparison.
- Implemented a synthetic-trace evaluation pipeline with scenario-grouped splits,
  a held-out fault family, and learned-versus-rule baseline comparisons.
- Added backend/ML regression tests covering numeric boundaries, invalid replay
  requests, original-run preservation, restart persistence, and storage failures.

Do not claim production deployment, autonomous repair, real-world accuracy,
general-agent support, or that the ML model outperforms the strong rule baseline.
Mention AI assistance honestly when asked and distinguish teammate contributions.

## Questions You Should Be Able To Answer

1. Why is the last failing step not necessarily the root cause?
2. What are the four features, and which domain knowledge do they encode?
3. Why split by scenario instead of randomly splitting individual traces?
4. What does the held-out answer-composition fault actually test?
5. Why does the rule baseline matching the model matter?
6. Why are scores not confidence percentages?
7. What state is in a checkpoint, and which steps execute during replay?
8. How do you prove the original is unchanged and a wrong fix can still fail?
9. Why is the JSON store restricted to a single worker?
10. What would you test before accepting real-world agent traces?
11. Why does an archived source create a selection failure even if its answer is copied exactly?
12. Why can correcting generation fail to repair an earlier selection error?

## Short Learning Path

For the document demo, start with Team eligibility / Wrong source. Retrieval
returns both eligibility documents. Selection chooses the archived one, so
generation faithfully copies an outdated rule. The final validator rejects it.
Diagnosis points to selection because the recorded source is archived. Replaying
step 2 with the current source reuses retrieval and executes selection, generation,
and validation again. This is manual checkpoint repair, not AI-generated repair.

Before trying it, predict which three outputs should change and which one should
remain identical. Then compare the branches. As a small ownership exercise,
change a fictional source sentence in `document_scenarios.py`, regenerate the
document benchmark, and explain why its scenario fingerprint changes.

Start with one calculation-error run. Trace the values from retrieval to final
validation. Read `backend/app/services/workflow.py` first, then `ml/features.py`,
`ml/train_model.py`, and the end-to-end test. Finally run the rule benchmark and
explain why both methods succeed on this particular generator.

The goal is not to memorize a polished explanation. Change one input yourself,
predict the behavior, then verify it. That is a concrete way to build ownership
after an AI-assisted implementation.
