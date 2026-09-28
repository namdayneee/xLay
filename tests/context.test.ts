import assert from "node:assert/strict";
import test from "node:test";
import { extractKeywords, scorePath } from "../src/context/keywords.js";

test("extracts useful Vietnamese-ish coding keywords", () => {
  const words = extractKeywords("sửa lỗi refresh token login, đừng sửa database");
  assert.ok(words.includes("refresh"));
  assert.ok(words.includes("token"));
  assert.ok(words.includes("login"));
  assert.ok(words.includes("database"));
});

test("auth path outranks unrelated payment path", () => {
  const keywords = extractKeywords("fix refresh token login");
  assert.ok(scorePath("src/auth/refresh-token.ts", keywords) > scorePath("src/payment/invoice.ts", keywords));
});
