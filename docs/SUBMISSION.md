# Submission Readiness

## What This Prototype Implements

Black Box records and diagnoses bounded local executions, restores pre-step
checkpoints, accepts a user-provided replacement output, executes the remaining
steps, preserves the original, and compares replay branches. The UI supports
both five-step arithmetic and four-step extractive document workflows.

## Problem Statement Mapping

| Requirement | Implemented evidence | Boundary |
|---|---|---|
| Execution recording | Structured step inputs/outputs, timing, errors, source IDs, checkpoints, JSON exports | Only the two local executors; no arbitrary external-agent recorder |
| Learned failure diagnosis | Arithmetic logistic-regression step ranker with grouped training/test split | Documents use explicitly labeled rules, not a trained document model |
| Supporting explanation | Observable arithmetic consistency checks and concrete document source/citation evidence | Domain-specific checks; not causal proof for general agents |
| Checkpointed replay | Persisted pre-step state, validated prefix/configuration, reused prefix, executed suffix | Local workflow versions only; validators cannot be overridden |
| Alternative execution | User-editable replacement JSON and new persisted branches | Known/manual alternatives; not autonomous fix generation |
| Model evaluation / unseen failures | Held-out arithmetic fault family, fresh-seed learned/rule comparisons; separate document regression report | Synthetic fixed topology; no independent real-agent generalization evidence |
| Trace comparison | Direct parent/branch outcomes, first divergence, changed-step filtering, original/replay outputs | Semantic output comparison, not infrastructure-level distributed tracing |

The document workflow broadens the demonstration beyond adding two numbers.
It does not turn this prototype into a general debugger or satisfy a learned
document-diagnosis claim. State that distinction explicitly.

## Suggested Demonstration Order

1. Create Team eligibility / Wrong source and inspect the archived answer.
2. Expand the fictional documents and show the current contradictory source.
3. Inspect rule evidence pointing to selection rather than the final validator.
4. Replay selection with `eligibility-current`; compare the successful branch.
5. Replay with `eligibility-archived`; show it remains failed.
6. Show one arithmetic calculation fault to demonstrate the learned ranker.
7. Open Evaluation and distinguish arithmetic model metrics from document rules.

Use `docs/DEMO.md` for exact inputs. All document packs are fictional. The
learned arithmetic model matches the strong rule baseline on this dataset;
it has not demonstrated an advantage over that baseline.

## Before Submission

- Run the Python quality gate, frontend tests, lint, TypeScript check, and build.
- Confirm `/ready` succeeds and create one fresh run through the browser.
- Keep the model artifact and its versioned metrics together.
- Exclude runtime state, virtual environments, node_modules, and secrets from sharing.
- Record the demo manually if a video is required; no video has been generated here.
- Check the organizer's actual submission deadline and file/link requirements.
- Describe your own contributions and AI assistance honestly.

## Next Work With The Highest Value

Collect independently labeled real-agent traces and evaluate diagnosis against
the strong observable-rule baseline. Add an explicit adapter contract before
attempting replay of external agents. A trained document diagnosis model needs
a suitable labeled dataset and evaluation plan; fictional fixtures alone are
not evidence of real-world generalization.
