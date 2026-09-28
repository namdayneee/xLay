import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "../src/config.js";
import { analyzeWithJev } from "../src/jev/client.js";

const repo = {
  repoName: "Matavi",
  cwd: "/tmp/Matavi",
  isGitRepo: true,
  candidateFiles: ["src/auth/token.ts"],
};

test("Jev client sends six decisions and parses typed answers", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any;
  globalThis.fetch = (async (_url: any, init?: any) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        model: "jev-1.13",
        answers: {
          task_type: { type: "choice", choice: "bug_fix", confidence: 0.96 },
          action_mode: { type: "choice", choice: "act", confidence: 0.95 },
          scope: { type: "choice", choice: "minimal", confidence: 0.91 },
          needs_validation: { type: "noul", noul: 0.98 },
          ambiguity: { type: "score", score: 1.2, confidence: 0.9 },
          safe_to_compact: { type: "noul", noul: 0.94 }
        },
        usage: { input_tokens: 120, output_tokens: 20 },
        credits_used: 1
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await analyzeWithJev({
      apiKey: "test-key",
      config: DEFAULT_CONFIG,
      endpoint: "https://example.test/jev",
      input: "sửa login, đừng sửa UI",
      agent: "claude",
      repo,
    });

    assert.equal(Object.keys(requestBody.questions).length, 6);
    assert.equal(result.source, "api");
    assert.equal(result.taskType.value, "bug_fix");
    assert.equal(result.actionMode.value, "act");
    assert.equal(result.scope.value, "minimal");
    assert.equal(result.needsValidation, 0.98);
    assert.equal(result.usage?.creditsUsed, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
