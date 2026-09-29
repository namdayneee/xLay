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

test("preserves whitespace, code, literal content and trailing words", () => {
  for (const input of ["  fix  login  ", "please fix:\n    x = 1", 'please output "please  wait"', "thêm từ với"]) {
    assert.equal(compactUserMessage(input, 0.5), input);
  }
  assert.equal(compactUserMessage("please fix:\n    x = 1", 1), "please fix:\n    x = 1");
  assert.equal(compactUserMessage('please output "please  wait"', 1), 'please output "please  wait"');
  assert.equal(compactUserMessage("thêm từ với", 1), "thêm từ với");
  assert.equal(compactUserMessage("please fix login", NaN), "please fix login");
  assert.equal(compactUserMessage("có thể lỗi nằm ở database", 1), "có thể lỗi nằm ở database");
  assert.equal(compactUserMessage("Bạn có thể gặp lỗi nếu sửa UI", 1), "Bạn có thể gặp lỗi nếu sửa UI");
});
