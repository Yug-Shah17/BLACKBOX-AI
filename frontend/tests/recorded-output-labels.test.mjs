import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const sourcePath = path.resolve("src/components/workspace/document-evidence.tsx");
const sourceCode = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(sourceCode, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React
  }
});
const sandbox = {
  exports: {},
  require: () => ({})
};
vm.runInNewContext(transpiled.outputText, sandbox);
const { classifyRecordedOutput } = sandbox.exports;

const mockDocument = {
  documentId: "doc-returns",
  title: "Current returns policy",
  topic: "returns policy",
  text: "Returns are accepted within 30 days of fictional purchase with receipt.",
  current: true
};

test("literal source extract is clearly labeled as such and includes the truthful explanation", () => {
  const run = {
    runId: "doc_test_extract",
    agentName: "local-document-agent",
    source: "controlled-local-document-workflow",
    steps: [
      { stepId: 1, stepType: "retrieval", status: "success", executionMode: "executed" },
      { stepId: 2, stepType: "selection", status: "success", executionMode: "executed" },
      {
        stepId: 3,
        stepType: "generation",
        status: "success",
        executionMode: "executed",
        inputData: {
          question: "What is the returns policy?",
          document: mockDocument
        },
        outputData: {
          answer: "Returns are accepted within 30 days of fictional purchase with receipt.",
          citation: "doc-returns"
        }
      }
    ]
  };

  const result = classifyRecordedOutput(run, run.steps[2], { question: "What is the returns policy?", documents: [mockDocument] });
  assert.equal(result.kind, "source_extract");
  assert.equal(result.label, "Literal source extract");
  assert.match(result.explanation, /Matching source text does not establish whether the user's question was answered/);
});

test("count output is accurately described when metadata supports it", () => {
  const countAnswer = 'The word "integrity" appears 3 times in the selected document (case-insensitive, whole-word matches).';
  const run = {
    runId: "doc_test_count",
    agentName: "local-document-agent",
    source: "controlled-local-document-workflow",
    steps: [
      {
        stepId: 1,
        stepType: "retrieval",
        status: "success",
        executionMode: "executed",
        inputData: { question: 'How many times does "integrity" appear?', operation: "word_count" },
        outputData: { documentIds: ["doc-policy"] }
      },
      {
        stepId: 2,
        stepType: "selection",
        status: "success",
        executionMode: "executed",
        outputData: { documentId: "doc-policy" }
      },
      {
        stepId: 3,
        stepType: "generation",
        status: "success",
        executionMode: "executed",
        inputData: {
          question: 'How many times does "integrity" appear?',
          document: { ...mockDocument, text: "Integrity integrity INTEGRITY." },
          expectedAnswer: countAnswer
        },
        outputData: {
          answer: countAnswer,
          citation: "doc-policy"
        }
      }
    ]
  };

  const result = classifyRecordedOutput(run, run.steps[2], null);
  assert.equal(result.kind, "word_count");
  assert.equal(result.label, "Deterministic word count");
  assert.match(result.explanation, /Word count computed locally/);
});

test("word count operation with unsupported answer is not falsely claimed as a count", () => {
  const run = {
    runId: "doc_test_count_failed",
    agentName: "local-document-agent",
    source: "controlled-local-document-workflow",
    steps: [
      {
        stepId: 1,
        stepType: "retrieval",
        status: "success",
        executionMode: "executed",
        inputData: { question: 'How many times does "integrity" appear?', operation: "word_count" },
        outputData: { documentIds: ["doc-policy"] }
      },
      {
        stepId: 3,
        stepType: "generation",
        status: "success",
        executionMode: "executed",
        inputData: {
          question: 'How many times does "integrity" appear?',
          document: mockDocument
        },
        outputData: {
          answer: "This answer is not supported by the selected document.",
          citation: "doc-policy"
        }
      }
    ]
  };

  const result = classifyRecordedOutput(run, run.steps[1], null);
  assert.notEqual(result.kind, "word_count");
  assert.equal(result.label, "Recorded answer");
  assert.match(result.explanation, /not a computed count/);
});

test("provider output is clearly distinguished and never mislabeled as a local extract", () => {
  // Even if the provider answer is a quote matching source document text
  const quoteFromDoc = "Returns are accepted within 30 days";
  const run = {
    runId: "doc_test_gemini",
    agentName: "gemini-document-agent",
    source: "controlled-local-document-workflow",
    steps: [
      {
        stepId: 3,
        stepType: "generation",
        status: "success",
        executionMode: "executed",
        toolName: "gemini-2.5-flash",
        inputData: {
          model: "gemini-2.5-flash",
          question: "What is the return window?",
          document: mockDocument,
          answerEvidence: {
            answer: quoteFromDoc,
            quotes: [quoteFromDoc],
            supported: true
          }
        },
        outputData: {
          answer: quoteFromDoc,
          citation: "doc-returns"
        }
      }
    ]
  };

  const result = classifyRecordedOutput(run, run.steps[0], { question: "What is the return window?", documents: [mockDocument] });
  assert.equal(result.kind, "provider");
  assert.equal(result.label, "Provider-generated answer");
  assert.notEqual(result.kind, "source_extract");
  assert.match(result.explanation, /Generated by external provider \(gemini-2\.5-flash\)/);
});

test("local output that does not match source text is not mislabeled as an extract", () => {
  const run = {
    runId: "doc_test_unmatched",
    agentName: "local-document-agent",
    source: "controlled-local-document-workflow",
    steps: [
      {
        stepId: 3,
        stepType: "generation",
        status: "error",
        executionMode: "executed",
        inputData: {
          question: "What is the return window?",
          document: mockDocument
        },
        outputData: {
          answer: "Items can be exchanged within 90 days.",
          citation: "doc-returns"
        }
      }
    ]
  };

  const result = classifyRecordedOutput(run, run.steps[0], { question: "What is the return window?", documents: [mockDocument] });
  assert.equal(result.kind, "unmatched");
  assert.equal(result.label, "Recorded answer");
  assert.match(result.explanation, /Recorded text does not match the cited source document/);
});

test("missing or legacy metadata does not crash or produce a false claim", () => {
  const legacyRun = {
    runId: "run_legacy_001",
    agentName: "travel-agent",
    source: "legacy-fixture",
    steps: [
      {
        stepId: 7,
        stepType: "final_answer",
        status: "failed",
        executionMode: "executed",
        outputData: { answer: "The weather in Bengaluru is 28C." }
      }
    ]
  };

  const legacyResult = classifyRecordedOutput(legacyRun, legacyRun.steps[0], null);
  assert.equal(legacyResult.kind, "legacy");
  assert.equal(legacyResult.label, "Recorded answer");
  assert.equal(legacyResult.explanation, undefined);

  const emptyResult = classifyRecordedOutput(null, null, null);
  assert.equal(emptyResult.kind, "none");
  assert.equal(emptyResult.label, "Recorded answer");

  const nullAnswerResult = classifyRecordedOutput({ agentName: "local-document-agent" }, { stepId: 3, stepType: "generation", outputData: { answer: null } }, null);
  assert.equal(nullAnswerResult.kind, "none");
  assert.equal(nullAnswerResult.label, "Recorded answer");
});
