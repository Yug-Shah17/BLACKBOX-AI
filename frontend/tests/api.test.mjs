import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/lib/api.ts";

test("structured validation errors identify the rejected field", async context => {
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ detail: [
    { loc: ["body", "question"], msg: "String should have at least 1 character", input: "private input" },
  ] }), { status: 422 }));
  await assert.rejects(api("/document-runs", { question: " " }), {
    message: "question: String should have at least 1 character",
  });
});

test("plain backend errors retain their actionable message", async context => {
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    detail: "Document checkpoint is missing or inconsistent",
  }), { status: 409 }));
  await assert.rejects(api("/document-runs/example/replay", {}), {
    message: "Document checkpoint is missing or inconsistent",
  });
});

test("non-JSON server failures explain recovery and retain the HTTP status", async context => {
  for (const status of [500, 502, 503]) {
    context.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status }));
    await assert.rejects(api("/document-runs"), {
      message: `The demo service could not complete this request (HTTP ${status}). Wait a moment, then try again; the free backend may need time to wake up.`,
    });
  }
});

test("explicit server detail takes priority over the generic recovery message", async context => {
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ detail: "Run storage is temporarily unavailable" }), { status: 503 }));
  await assert.rejects(api("/document-runs"), { message: "Run storage is temporarily unavailable" });
});

test("non-JSON not-found responses retain their original status fallback", async context => {
  context.mock.method(globalThis, "fetch", async () => new Response("Not found", { status: 404 }));
  await assert.rejects(api("/document-runs/missing"), { message: "Request failed (404)" });
});

test("network failures give a recovery action without leaking request data", async context => {
  context.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(api("/document-runs", { question: "private question" }), {
    message: "Could not reach the local service. Check that Black Box is running, then try again.",
  });
});

test("request cancellation remains cancellation rather than a connectivity error", async context => {
  const controller = new AbortController();
  controller.abort();
  context.mock.method(globalThis, "fetch", async () => { throw new DOMException("Cancelled", "AbortError"); });
  await assert.rejects(api("/runs", undefined, controller.signal), { name: "AbortError" });
});
