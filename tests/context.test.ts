import assert from "node:assert/strict";
import test from "node:test";
import { extractKeywords, scorePath } from "../src/context/keywords.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { collectRepoContext, collectCandidates, selectCandidates } from "../src/context/repo.js";
import { localFallbackDecision } from "../src/jev/fallback.js";

test("extracts useful Vietnamese-ish coding keywords", () => {
  const words = extractKeywords("sửa lỗi refresh token login, đừng sửa database");
  assert.ok(words.includes("refresh"));
  assert.ok(words.includes("token"));
  assert.ok(words.includes("login"));
  assert.ok(words.includes("database"));
});

test("Vietnamese concepts retrieve English implementation paths", () => {
  const words = extractKeywords("sửa lỗi đăng nhập");
  assert.ok(scorePath("src/auth/session.ts", words) > scorePath("src/billing/invoice.ts", words));
});

test("Jev reranks semantic matches; explicit paths and uncertain answers survive", () => {
  const candidates = ["a.ts", "b.ts", "c.ts", "d.ts"].map((path, i) => ({ path, excerpt: "", fingerprint: "", explicit: i === 3 }));
  const decision = localFallbackDecision("fix login");
  decision.source = "api";
  decision.relevance = { "a.ts": { score: 0, confidence: 0.99 }, "b.ts": { score: 3, confidence: 0.9 }, "c.ts": { score: 0, confidence: 0.1 }, "d.ts": { score: 0, confidence: 0.99 } };
  assert.deepEqual(selectCandidates(candidates, decision, 3).map(c => c.path), ["d.ts", "b.ts", "c.ts"]);
  assert.deepEqual(selectCandidates(candidates, localFallbackDecision("fix"), 2).map(c => c.path), ["d.ts", "a.ts"]);
  assert.deepEqual(selectCandidates([{ ...candidates[0], localScore: 0 }], localFallbackDecision("fix"), 2), []);
});

test("shortlists exclude sensitive and generated files and bound text excerpts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xlay-safe-context-"));
  try {
    execFileSync("git", ["init", "-q", root]);
    for (const file of ["auth.ts", "credentials.json", ".env", "key.pem"]) fs.writeFileSync(path.join(root, file), "auth\n".repeat(200));
    fs.mkdirSync(path.join(root, "dist"));
    fs.writeFileSync(path.join(root, "dist", "auth.js"), "generated");
    execFileSync("git", ["add", "."], { cwd: root });
    const repo = collectCandidates(root, "đăng nhập auth");
    assert.deepEqual(repo.candidateFiles, ["auth.ts"]);
    assert.ok(Buffer.byteLength(repo.candidates![0].excerpt) <= 512);
    assert.ok(repo.candidates![0].fingerprint.length === 64);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("context uses policy budget, handles Unicode paths and preserves invocation cwd", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xlay-context-"));
  try {
    execFileSync("git", ["init", "-q", root]);
    const cwd = path.join(root, "src");
    fs.mkdirSync(cwd);
    for (const name of ["login.ts", "login-token.ts", "login-tiếng Việt.ts"]) fs.writeFileSync(path.join(cwd, name), "");
    execFileSync("git", ["add", "."], { cwd: root });
    assert.deepEqual(collectRepoContext(cwd, "login", 0).candidateFiles, []);
    const context = collectRepoContext(cwd, "login", 2);
    assert.equal(context.cwd, cwd);
    assert.equal(context.candidateFiles.length, 2);
    assert.ok(collectRepoContext(cwd, "login", 6).candidateFiles.includes("src/login-tiếng Việt.ts"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("auth path outranks unrelated payment path", () => {
  const keywords = extractKeywords("fix refresh token login");
  assert.ok(scorePath("src/auth/refresh-token.ts", keywords) > scorePath("src/payment/invoice.ts", keywords));
});
