import test from "node:test";
import assert from "node:assert/strict";
import { readDocuments } from "../src/lib/document-upload.ts";

test("text and Markdown files become distinct source documents", async () => {
  const docs = await readDocuments([new File(["Returns accepted within 30 days."], "policy.txt"), new File(["# Team eligibility\nTeams have 2 to 4 students."], "rules.md")]);
  assert.equal(docs.length, 2);
  assert.notEqual(docs[0].documentId, docs[1].documentId);
  assert.equal(docs[0].text, "Returns accepted within 30 days.");
  assert.match(docs[1].topic, /eligibility/);
  assert.equal(docs[0].current, true);
});

test("invalid batches and file contents are rejected without partial results", async () => {
  for (const [files, message] of [
    [[], /1 and 10/],
    [Array.from({ length: 11 }, () => new File(["text"], "a.txt")), /1 and 10/],
    [[new File(["text"], "a.doc")], /legacy .doc/],
    [[new File([" "], "empty.txt")], /1 to 10,000/],
    [[new File(["x".repeat(10001)], "long.md")], /1 to 10,000/],
    [[new File(["x".repeat(40001)], "big.txt")], /40 KB/],
    [[new File([new Uint8Array([255])], "bad.txt")], /UTF-8/],
    [[new File(["hello\u0000"], "binary.txt")], /binary/],
    [[new File(["okay"], "valid.txt"), new File(["bad"], "wrong.doc")], /legacy .doc/],
    [[new File([new Uint8Array(2000001)], "big.pdf")], /2 MB/],
  ]) await assert.rejects(readDocuments(files), message);
});

test("duplicate filenames keep separate stable identifiers and text is not executed", async () => {
  const docs = await readDocuments([new File(["<script>alert(1)</script>"], "notes.md"), new File(["other text"], "notes.md")]);
  assert.notEqual(docs[0].documentId, docs[1].documentId);
  assert.equal(docs[0].text, "<script>alert(1)</script>");
});

test("PDF and DOCX use sequential local extraction and surface parser errors", async t => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push([url, options]);
    return new Response(JSON.stringify({ documentId: `upload-${requests.length}`, title: options.body.name,
      topic: "returns", text: "30 days", current: true }));
  });
  const docs = await readDocuments([new File(["pdf"], "my policy.pdf"), new File(["word"], "rules.docx")]);
  assert.equal(docs.length, 2);
  assert.match(requests[0][0], /filename=my%20policy.pdf/);
  assert.equal(requests[0][1].headers["Content-Type"], "application/octet-stream");
  globalThis.fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ detail: "Encrypted PDFs are not supported." }), { status: 422 }));
  await assert.rejects(readDocuments([new File(["pdf"], "secret.pdf")]), /Encrypted PDFs/);
});

test("malformed extraction responses are rejected before preview", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>proxy error</html>", { status: 200 }));
  await assert.rejects(readDocuments([new File(["pdf"], "policy.pdf")]), /invalid extraction response/i);
  for (const value of [{}, { documentId: "x", title: "a", topic: "a", text: "", current: true },
    { documentId: "x", title: "a", topic: "a", text: "okay", current: "true" }]) {
    globalThis.fetch.mock.mockImplementation(async () => new Response(JSON.stringify(value)));
    await assert.rejects(readDocuments([new File(["pdf"], "policy.pdf")]), /invalid extraction response/i);
  }
});

test("cancelled uploads do not start extraction", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("{}"));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(readDocuments([new File(["pdf"], "policy.pdf")], controller.signal), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), 0);
});

test("cancel during extraction ignores its eventual response", async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async () => {
    controller.abort();
    return new Response(JSON.stringify({ documentId: "x", title: "policy.pdf", topic: "returns", text: "30 days", current: true }));
  });
  await assert.rejects(readDocuments([new File(["pdf"], "policy.pdf")], controller.signal), { name: "AbortError" });
});

test("network and non-JSON proxy failures have filename-specific errors", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(readDocuments([new File(["pdf"], "policy.pdf")]), /policy.pdf: could not reach the local extractor/);
  globalThis.fetch.mock.mockImplementation(async () => new Response("proxy unavailable", { status: 503 }));
  await assert.rejects(readDocuments([new File(["pdf"], "policy.pdf")]), /policy.pdf: Extraction failed \(503\)/);
});
