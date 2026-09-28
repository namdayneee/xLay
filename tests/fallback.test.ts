import assert from "node:assert/strict";
import test from "node:test";
import { localFallbackDecision } from "../src/jev/fallback.js";

test("a scoped do-not-edit constraint does not turn a fix into inspect-only", () => {
  const d = localFallbackDecision("sửa login, đừng sửa UI và không đổi database");
  assert.equal(d.taskType.value, "bug_fix");
  assert.equal(d.actionMode.value, "act");
});

test("explicit no-code-edit request becomes inspect-only", () => {
  const d = localFallbackDecision("chỉ xem nguyên nhân, đừng sửa code");
  assert.equal(d.actionMode.value, "inspect_only");
});
