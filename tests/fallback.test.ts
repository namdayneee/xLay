import assert from "node:assert/strict";
import test from "node:test";
import { localFallbackDecision } from "../src/jev/fallback.js";

test("a scoped do-not-edit constraint does not turn a fix into inspect-only", () => {
  const d = localFallbackDecision("sửa login, đừng sửa UI và không đổi database");
  assert.equal(d.taskType.value, "bug_fix");
  assert.equal(d.actionMode.value, "act");
});

test("review, explanation and English no-edit intent stay read-only", () => {
  for (const input of ["review authentication", "inspect auth; do not edit files", "fix diagnosis, don't change code"]) {
    assert.equal(localFallbackDecision(input).actionMode.value, "inspect_only");
  }
  assert.equal(localFallbackDecision("giải thích login").actionMode.value, "explain_only");
  assert.equal(localFallbackDecision("fix it").ambiguity.score, 3);
  assert.ok(localFallbackDecision("fix it", true).ambiguity.score < 2.5);
});

test("explicit no-code-edit request becomes inspect-only", () => {
  const d = localFallbackDecision("chỉ xem nguyên nhân, đừng sửa code");
  assert.equal(d.actionMode.value, "inspect_only");
});
