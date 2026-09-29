import assert from "node:assert/strict";
import test from "node:test";
import { compileAgentPrompt } from "../src/compiler.js";
import { resolvePolicy } from "../src/policy.js";
import type { JevDecision, RepoContext } from "../src/types.js";

const decision: JevDecision = {
  taskType: { value: "bug_fix", confidence: 0.96 },
  actionMode: { value: "act", confidence: 0.94 },
  scope: { value: "minimal", confidence: 0.91 },
  needsValidation: 0.98,
  ambiguity: { score: 1.1, confidence: 0.9 },
  safeToCompact: 0.95,
  source: "api",
};

const repo: RepoContext = {
  repoName: "Matavi",
  cwd: "/tmp/Matavi",
  isGitRepo: true,
  candidateFiles: ["src/auth/token.ts", "tests/auth.test.ts"],
};

test("compiled prompt keeps request constraints and context hints", () => {
  const prompt = compileAgentPrompt(
    "giúp tôi sửa login, đừng sửa UI, không đổi database nhé",
    resolvePolicy("sửa login", decision, 6),
    repo,
  );
  assert.match(prompt, /đừng sửa UI/i);
  assert.match(prompt, /không đổi database/i);
  assert.match(prompt, /src\/auth\/token\.ts/);
  assert.match(prompt, /mode=act/);
});

test("compiler consumes policy rather than raw Jev metadata and refuses blocked turns", () => {
  const policy = resolvePolicy("fix login", decision, 1);
  const prompt = compileAgentPrompt("fix login\n  preserve spacing", policy, repo);
  assert.match(prompt, /fix login\n  preserve spacing/);
  assert.doesNotMatch(prompt, /tests\/auth.test.ts|xlay_decision|confidence/);
  assert.throws(() => compileAgentPrompt("fix", { ...policy, dispatch: "clarify" }, repo));
});
