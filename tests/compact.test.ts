import assert from "node:assert/strict";
import test from "node:test";
import { compactUserMessage } from "../src/jev/compact.js";

test("compacts filler but keeps hard constraints", () => {
  const result = compactUserMessage(
    "Bạn có thể giúp tôi sửa login, đừng sửa UI và không đổi database nhé",
    0.95,
  );
  assert.match(result, /sửa login/i);
  assert.match(result, /đừng sửa UI/i);
  assert.match(result, /không đổi database/i);
  assert.doesNotMatch(result, /^Bạn có thể/i);
});

test("does not compact when Jev is uncertain", () => {
  const original = "Bạn có thể giúp tôi xem phần login nhé";
  assert.equal(compactUserMessage(original, 0.5), original);
});
