import test from "node:test";
import assert from "node:assert/strict";
import { documentReplacement } from "../src/lib/document-replacement.ts";

const documents = [
  { documentId: "policy-old", topic: "returns policy", text: "7 days", current: false },
  { documentId: "policy", topic: "returns policy", text: "30 days", current: true },
  { documentId: "notice", topic: "library maintenance", text: "Closed Sunday", current: true },
];
const context = { question: "When is library maintenance?", documents };
const run = { steps: [
  { stepType: "retrieval", inputData: { question: context.question }, outputData: { documentIds: ["notice"] } },
  { stepType: "selection", inputData: { documents: [documents[2]] } },
  { stepType: "generation", inputData: { document: documents[2] } },
] };

test("retrieval replacement excludes unrelated current sources", () => {
  assert.deepEqual(documentReplacement(run, 1, context), { documentIds: ["notice"] });
});

test("selection replacement stays within recorded retrieval", () => {
  assert.deepEqual(documentReplacement(run, 2, context), { documentId: "notice" });
});

test("answer replacement uses the actually selected source", () => {
  assert.deepEqual(documentReplacement(run, 3, context), { answer: "Closed Sunday", citation: "notice" });
});

test("a missing retrieval cannot suggest selecting a source outside its checkpoint", () => {
  const missing = structuredClone(run);
  missing.steps[0].outputData.documentIds = [];
  assert.deepEqual(documentReplacement(missing, 2, context), { documentId: "" });
  assert.deepEqual(documentReplacement(missing, 1, context), { documentIds: ["notice"] });
});

test("an answer-step suggestion does not silently repair archived selection", () => {
  const archived = structuredClone(run);
  archived.steps[2].inputData.document = documents[0];
  assert.deepEqual(documentReplacement(archived, 3, context), { answer: "7 days", citation: "policy-old" });
});

test("recorded candidates remain usable when the source endpoint is unavailable", () => {
  assert.deepEqual(documentReplacement(run, 2), { documentId: "notice" });
});

test("word-count replay uses the computed answer rather than copying the source", () => {
  const countRun = structuredClone(run);
  countRun.steps[0].inputData.operation = "word_count";
  countRun.steps[0].inputData.question = "How many times was the word respect repeated?";
  countRun.steps[2].inputData.expectedAnswer = 'The word "respect" appears 0 times in the selected document (case-insensitive, whole-word matches).';
  assert.deepEqual(documentReplacement(countRun, 1), { documentIds: ["notice"] });
  assert.deepEqual(documentReplacement(countRun, 3), {
    answer: countRun.steps[2].inputData.expectedAnswer, citation: "notice",
  });
});

test("hosted QA retrieves supplied documents and suggests a literal evidence quote", () => {
  const hosted = structuredClone(run);
  hosted.steps[0].inputData.operation = "provided_documents";
  hosted.steps[2].inputData.answerEvidence = { answer: "The library closes on Sunday.", quotes: ["Closed Sunday"], supported: true };
  assert.deepEqual(documentReplacement(hosted, 1, context), { documentIds: ["policy-old", "policy", "notice"] });
  assert.deepEqual(documentReplacement(hosted, 3, context), { answer: "Closed Sunday", citation: "notice" });
});
