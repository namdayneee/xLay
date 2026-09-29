import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUsage } from "../src/metrics.js";
import { compareRuns } from "../src/benchmark.js";

test("normalizes reported token usage without double counting caches", () => {
  assert.deepEqual(normalizeUsage("claude", { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 80, cache_creation_input_tokens: 10 }), { input: 100, output: 5, cached: 80, total: 105 });
  assert.deepEqual(normalizeUsage("codex", { input_tokens: 100, output_tokens: 5, cached_input_tokens: 80 }), { input: 100, output: 5, cached: 80, total: 105 });
  assert.equal(normalizeUsage("claude"), undefined);
  assert.equal(normalizeUsage("codex", { input_tokens: NaN, output_tokens: 1 }), undefined);
});

test("benchmark pairs measured runs and separates Jev overhead from agent savings", () => {
  const baseline = { taskId: "task", agent: "claude", mode: "baseline", exitCode: 0, tokens: { input: 90, output: 10, cached: 0, total: 100 } };
  const optimized = { ...baseline, mode: "optimized", jevSource: "api", jevUsage: { inputTokens: 50, outputTokens: 10 }, tokens: { input: 40, output: 10, cached: 0, total: 50 } };
  const report = compareRuns([baseline], [optimized]);
  assert.equal(report.agentReductionPercent, 50);
  assert.ok(Math.abs(report.combinedReductionPercent! + 10) < 0.00001);
  assert.equal(compareRuns([baseline], [{ ...optimized, exitCode: 1 }]).pairs.length, 0);
  assert.equal(compareRuns([baseline], [{ ...optimized, tokens: undefined }]).pairs.length, 0);
  assert.equal(compareRuns([baseline, baseline], [optimized]).pairs.length, 0);
  assert.equal(compareRuns([baseline], [{ ...optimized, jevUsage: undefined }]).pairs.length, 0);
  assert.equal(compareRuns([baseline], [{ ...optimized, jevSource: "local-fallback", jevAttempted: true, jevUsage: undefined }]).pairs.length, 0);
});
