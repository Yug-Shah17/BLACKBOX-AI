import test from "node:test";
import assert from "node:assert/strict";
import { runReport } from "../src/lib/run-report.ts";

const run = { runId: "doc_test", task: "What is the policy?", agentName: "local-document-agent", outcome: "failed",
  timestamp: "2026-10-06T12:00:00Z", source: "controlled-local-document-workflow", steps: [
    { stepId: 1, stepType: "retrieval", status: "success", executionMode: "reused" },
    { stepId: 2, stepType: "selection", status: "error", executionMode: "executed" },
  ] };
test("report contains evidence and honest scope without hidden configuration", () => {
  const text = runReport({ ...run, config: { failureType: "SECRET_LABEL" } }, {
    mode: "rules", predictedFailureStep: 2, explanation: "Archived source selected.", evidence: ["Source old is archived."] });
  assert.match(text, /Likely failure step: 2/);
  assert.match(text, /Source old is archived/);
  assert.match(text, /rule-based/);
  assert.match(text, /1\. retrieval: success \(reused\)/);
  assert.doesNotMatch(text, /SECRET_LABEL/);
});

test("missing diagnosis and legacy records are not called healthy or learned", () => {
  const text = runReport({ ...run, runId: "legacy", source: "legacy-fixture" });
  assert.match(text, /Likely failure step: unavailable/);
  assert.match(text, /Imported legacy fixture/);
  assert.doesNotMatch(text, /Arithmetic learned ranking/);
});

test("selected comparison identifies its branch and actual outcomes", () => {
  const text = runReport(run, null, { originalRunId: "doc_test", replayRunId: "doc_branch",
    originalOutcome: "failed", replayOutcome: "failed", divergenceStep: 2,
    steps: [{ stepId: 1, changed: false }, { stepId: 2, changed: true }] });
  assert.match(text, /Replay: doc_branch \(failed\)/);
  assert.match(text, /Changed steps: 2/);
  assert.doesNotMatch(text, /Outcome improved/);
});

test("hosted answer reports distinguish generation from rule diagnosis", () => {
  const text = runReport({ ...run, agentName: "gemini-document-agent" });
  assert.match(text, /Gemini/);
  assert.match(text, /not semantic correctness proof/);
  assert.doesNotMatch(text, /Document answers are extractive/);
});
