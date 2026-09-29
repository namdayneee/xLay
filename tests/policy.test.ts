import assert from "node:assert/strict";
import test from "node:test";
import { resolvePolicy } from "../src/policy.js";
import { localFallbackDecision } from "../src/jev/fallback.js";
import { prepareTurn } from "../src/turn.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { ShellState } from "../src/session/state.js";

function decision() {
  const d = localFallbackDecision("fix login");
  d.source = "api";
  d.actionMode.confidence = 0.95;
  d.scope.confidence = 0.95;
  return d;
}

test("ambiguity and uncertain authorization gate dispatch", () => {
  const d = decision();
  d.ambiguity = { score: 3, confidence: 0.9 };
  assert.equal(resolvePolicy("fix login", d, 6).dispatch, "clarify");
  d.ambiguity.confidence = 0.3;
  assert.equal(resolvePolicy("fix login", d, 6).dispatch, "run");
  d.actionMode.confidence = 0.69;
  assert.equal(resolvePolicy("fix login", d, 6).dispatch, "clarify");
});

test("scope applies actual budgets and honors local minimal restriction", () => {
  const d = decision();
  d.scope.value = "broad";
  assert.equal(resolvePolicy("fix login", d, 12).contextLimit, 12);
  assert.equal(resolvePolicy("minimal fix login", d, 12).contextLimit, 2);
  d.scope.value = "focused";
  assert.equal(resolvePolicy("fix login", d, 12).contextLimit, 6);
  assert.equal(resolvePolicy("fix login", d, -3).contextLimit, 0);
  assert.equal(resolvePolicy("fix login", d, NaN).contextLimit, 6);
});

test("explicit read-only intent wins over API act; scoped restrictions permit fixes", () => {
  const d = decision();
  assert.equal(resolvePolicy("chỉ xem, đừng sửa code", d, 6).mode, "inspect_only");
  assert.equal(resolvePolicy("sửa login, đừng sửa UI", d, 6).mode, "act");
  assert.equal(resolvePolicy("chỉ giải thích login", d, 6).mode, "explain_only");
  assert.equal(resolvePolicy("fix login", d, 6).validation, "relevant");
});

test("compaction requires trusted high confidence", () => {
  const d = decision();
  d.safeToCompact = 0.89;
  assert.equal(resolvePolicy("please fix login", d, 6).compact, false);
  d.safeToCompact = 0.95;
  assert.equal(resolvePolicy("please fix login", d, 6).compact, true);
  d.source = "local-fallback";
  assert.equal(resolvePolicy("please fix login", d, 6).compact, false);
});

test("turn pipeline withholds prompt for clarification; fallback still runs concrete tasks", async () => {
  const options = { cwd: process.cwd(), agent: "claude" as const, config: DEFAULT_CONFIG, endpoint: "https://example.test" };
  const blocked = await prepareTurn({ ...options, input: "fix it" });
  assert.equal(blocked.policy.dispatch, "clarify");
  assert.equal(blocked.prompt, undefined);
  assert.deepEqual(blocked.repo.candidateFiles, []);
  const ready = await prepareTurn({ ...options, input: "fix login, preserve UI" });
  assert.equal(ready.policy.dispatch, "run");
  assert.match(ready.prompt!, /preserve UI/);
  const followup = await prepareTurn({ ...options, input: "fix it", hasSession: true });
  assert.equal(followup.policy.dispatch, "run");
});

test("agent switches keep independent resumable sessions", () => {
  const state = new ShellState("claude");
  state.currentSessionId = "claude-session";
  state.agent = "codex";
  assert.equal(state.currentSessionId, undefined);
  state.currentSessionId = "codex-session";
  state.agent = "claude";
  assert.equal(state.currentSessionId, "claude-session");
});
