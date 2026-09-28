import assert from "node:assert/strict";
import test from "node:test";
import { compileAgentPrompt } from "../src/compiler.js";
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
    decision,
    repo,
  );
  assert.match(prompt, /đừng sửa UI/i);
  assert.match(prompt, /không đổi database/i);
  assert.match(prompt, /src\/auth\/token\.ts/);
  assert.match(prompt, /mode=act/);
});
