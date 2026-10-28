import test from "node:test";
import assert from "node:assert/strict";
import { startGuidedDemo } from "../src/lib/api.ts";

test("guided failure uses catalog evidence and local mode without external consent", async context => {
  const documents = [{ documentId: "current", title: "Registration", topic: "registration", text: "Registration closes Friday.", current: true }];
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(calls.length === 1 ? [{ id: "registration", question: "When does registration close?", documents }] : { runId: "doc_guided", outcome: "failed" }));
  });
  assert.equal((await startGuidedDemo()).runId, "doc_guided");
  assert.equal(calls[0].url, "/api/blackbox/document-scenarios");
  assert.equal(calls[1].url, "/api/blackbox/document-runs");
  assert.deepEqual(JSON.parse(calls[1].options.body), { question: "When does registration close?", documents, failureType: "unsupported_answer", answeringMode: "local", allowExternalProcessing: false });
});

test("an unavailable catalog does not create a misleading demo run", async context => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => { calls++; return new Response("[]"); });
  await assert.rejects(startGuidedDemo(), /fictional demo documents are unavailable/);
  assert.equal(calls, 1);
});
