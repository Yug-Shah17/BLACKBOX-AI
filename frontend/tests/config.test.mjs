import assert from "node:assert/strict";
import test from "node:test";
import config from "../next.config.ts";

test("backend proxy keeps its local default and normalizes configured origins", async () => {
  const previous = process.env.BACKEND_URL;
  try {
    for (const [value, expected] of [
      [undefined, "http://127.0.0.1:8000/:path*"],
      ["  ", "http://127.0.0.1:8000/:path*"],
      [" https://example.test/ ", "https://example.test/:path*"],
      ["https://example.test///", "https://example.test/:path*"],
    ]) {
      if (value === undefined) delete process.env.BACKEND_URL;
      else process.env.BACKEND_URL = value;
      const rules = await config.rewrites();
      assert.equal(rules[0].source, "/api/blackbox/:path*");
      assert.equal(rules[0].destination, expected);
    }
  } finally {
    if (previous === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previous;
  }
});
