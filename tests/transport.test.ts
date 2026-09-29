import assert from "node:assert/strict";
import test from "node:test";
import { requestDecision } from "../src/jev/transport.js";

test("retries TypeSafe transient errors and honors Retry-After within deadline", async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async (_url, init) => {
      assert.equal(init?.redirect, "error");
      return ++calls === 1 ? new Response("busy", { status: 529, headers: { "retry-after": "0" } }) : new Response('{"answers":{}}');
    }) as typeof fetch;
    assert.deepEqual(await requestDecision("https://api.typesafe.ai/v1/systemone", "test", {}, 1000), { answers: {} });
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = (async () => { calls++; return new Response("busy", { status: 429, headers: { "retry-after": "60" } }); }) as typeof fetch;
    await assert.rejects(requestDecision("https://api.typesafe.ai/v1/systemone", "test", {}, 1000), /http-429/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = saved; }
});

test("oversize requests fail locally without dropping user constraints", async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = (() => { assert.fail("must not send oversized request"); }) as typeof fetch;
    await assert.rejects(requestDecision("https://api.typesafe.ai/v1/systemone", "test", { input: "x".repeat(30000) }, 1000), /request-budget/);
  } finally { globalThis.fetch = saved; }
});
