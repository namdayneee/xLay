import assert from "node:assert/strict";
import test from "node:test";
import { runClaude } from "../src/agents/claude.js";
import { runCodex } from "../src/agents/codex.js";
import type { Channel, RunChannel } from "../src/agents/channel.js";

function fake(script: (options: Parameters<RunChannel>[0], channel: Channel, sent: any[]) => Promise<void>): RunChannel {
  return async options => {
    const sent: any[] = [];
    const abort = new AbortController();
    const channel: Channel = { send: message => sent.push(message), finish: () => abort.abort(), fail: error => { throw error; }, signal: abort.signal };
    try { options.start(channel); await script(options, channel, sent); return 0; }
    finally { abort.abort(); }
  };
}

test("Claude answers the actual pending tool once, preserves arguments and resumes same turn", async () => {
  for (const allowed of [true, false]) {
    let approvals = 0;
    const transport = fake(async (options, channel, sent) => {
      assert.ok(options.args.includes("--input-format"));
      assert.ok(options.args.includes("stdio"));
      assert.ok(!options.args.some(arg => /skip-permissions|acceptEdits|bypass/i.test(arg)));
      assert.equal(sent[0].request.subtype, "initialize");
      await options.receive({ type: "control_response", response: { subtype: "success", request_id: "xlay-init" } }, channel);
      assert.equal(sent[1].message.content, "update README");
      const request = { type: "control_request", request_id: "permission-1", request: { subtype: "can_use_tool", tool_name: "Write", input: { file_path: "README.md", content: "new content" } } };
      await options.receive(request, channel);
      const response = sent[2].response;
      assert.equal(response.request_id, request.request_id);
      assert.equal(response.response.behavior, allowed ? "allow" : "deny");
      if (allowed) assert.deepEqual(response.response.updatedInput, request.request.input);
      assert.equal(response.response.updatedPermissions, undefined);
      await options.receive(request, channel);
      assert.equal(sent.length, 3);
      await options.receive({ type: "result", session_id: "session", usage: { input_tokens: 10, output_tokens: 2 } }, channel);
    });
    const result = await runClaude("update README", ".", "session", async request => { approvals++; assert.equal(request.agent, "claude"); return allowed; }, transport);
    assert.equal(approvals, 1);
    assert.equal(result.exitCode, 0);
    assert.equal(result.sessionId, "session");
    assert.equal(result.usage?.input_tokens, 10);
  }
});

test("cancelled Claude approval does not send a stale allow", async () => {
  const transport = fake(async (options, channel, sent) => {
    await options.receive({ type: "control_response", response: { subtype: "success", request_id: "xlay-init" } }, channel);
    const waiting = options.receive({ type: "control_request", request_id: "cancelled", request: { subtype: "can_use_tool", tool_name: "Write", input: {} } }, channel);
    await options.receive({ type: "control_cancel_request", request_id: "cancelled" }, channel);
    await waiting;
    assert.equal(sent.filter(event => event.type === "control_response").length, 0);
    await options.receive({ type: "result", is_error: false }, channel);
  });
  await runClaude("fix", ".", undefined, async (_request, signal) => await new Promise(resolve => signal.addEventListener("abort", () => resolve(true))), transport);
});

test("Codex app-server approves commands and edits without changing permissions", async () => {
  const transport = fake(async (options, channel, sent) => {
    assert.deepEqual(options.args, ["app-server"]);
    await options.receive({ id: "xlay-init", result: {} }, channel);
    assert.equal(sent[2].method, "thread/resume");
    assert.deepEqual(sent[2].params, { threadId: "thread", cwd: "." });
    await options.receive({ id: "xlay-thread", result: { thread: { id: "thread" } } }, channel);
    assert.equal(sent[3].method, "turn/start");
    await options.receive({ id: "xlay-turn", result: { turn: { id: "turn" } } }, channel);
    for (const method of ["item/commandExecution/requestApproval", "item/fileChange/requestApproval"]) {
      await options.receive({ id: method, method, params: { threadId: "thread", turnId: "turn", itemId: "item", command: "npm test" } }, channel);
      assert.deepEqual(sent.at(-1), { id: method, result: { decision: "accept" } });
    }
    await options.receive({ method: "thread/tokenUsage/updated", params: { threadId: "thread", tokenUsage: { last: { inputTokens: 10, outputTokens: 2, cachedInputTokens: 4 } } } }, channel);
    await options.receive({ method: "turn/completed", params: { threadId: "thread", turn: { id: "turn", status: "completed" } } }, channel);
  });
  const result = await runCodex("fix", ".", "thread", async () => true, transport);
  assert.equal(result.exitCode, 0);
  assert.equal(result.sessionId, "thread");
  assert.equal(result.usage?.cached_input_tokens, 4);
});

test("Codex rejects cross-thread requests and fails clearly on obsolete protocol", async () => {
  await runCodex("fix", ".", "thread", async () => { assert.fail("wrong thread must not prompt"); }, fake(async (options, channel, sent) => {
    await options.receive({ id: 1, method: "item/fileChange/requestApproval", params: { threadId: "other" } }, channel);
    assert.deepEqual(sent.at(-1).result, { decision: "decline" });
  }));
  await assert.rejects(runCodex("fix", ".", undefined, undefined, fake(async (options, channel) => {
    await options.receive({ id: "xlay-thread", error: { code: -32601, message: "Method not found" } }, channel);
  })), /update Codex CLI/);
});
