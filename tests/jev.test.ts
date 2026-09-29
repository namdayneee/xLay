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
        model: "jev-1.13.0",
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
    assert.equal(requestBody.model, "jev-1.13.0");
    assert.equal(result.source, "api");
    assert.equal(result.taskType.value, "bug_fix");
    assert.equal(result.actionMode.value, "act");
    assert.equal(result.scope.value, "minimal");
    assert.equal(result.needsValidation, 0.98);
    assert.equal(result.usage?.inputTokens, 120);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TypeSafe evaluates candidate-specific questions in the policy call", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.questions.file_0.instructions.candidate_path, "src/auth/token.ts");
      assert.match(body.questions.file_0.instructions.excerpt, /refreshSession/);
      return new Response(JSON.stringify({ model: "jev-1.13.0", answers: {
        task_type: { type: "choice", choice: "bug_fix", confidence: 0.9 },
        action_mode: { type: "choice", choice: "act", confidence: 0.9 },
        scope: { type: "choice", choice: "focused", confidence: 0.9 },
        needs_validation: { type: "noul", noul: 1 },
        ambiguity: { type: "score", score: 0, confidence: 1 },
        safe_to_compact: { type: "noul", noul: 0 },
        file_0: { type: "score", score: 3, confidence: 0.95 },
      }, usage: { input_tokens: 400, output_tokens: 30 } }));
    }) as typeof fetch;
    const result = await analyzeWithJev({ apiKey: "test", endpoint: DEFAULT_CONFIG.jev.endpoint, config: DEFAULT_CONFIG, input: "sửa đăng nhập", agent: "claude",
      repo: { ...repo, candidates: [{ path: "src/auth/token.ts", excerpt: "function refreshSession() {}", fingerprint: "test", explicit: false }] } });
    assert.equal(result.source, "api");
    assert.equal(result.relevance?.["src/auth/token.ts"].score, 3);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("invalid, partial, HTTP and network responses use local restrictions", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const response of [ {}, { answers: { action_mode: { choice: "act", confidence: 1 } } }, null, "bad JSON", 503 ]) {
      globalThis.fetch = (async () => typeof response === "number"
        ? new Response("unavailable", { status: response })
        : new Response(typeof response === "string" ? response : JSON.stringify(response))) as typeof fetch;
      const result = await analyzeWithJev({ apiKey: "test", config: DEFAULT_CONFIG, endpoint: "https://example.test", input: "chỉ xem, đừng sửa code", agent: "claude", repo });
      assert.equal(result.source, "local-fallback");
      assert.equal(result.actionMode.value, "inspect_only");
    }
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    assert.equal((await analyzeWithJev({ apiKey: "test", config: DEFAULT_CONFIG, endpoint: "https://example.test", input: "fix login", agent: "claude", repo })).source, "local-fallback");
  } finally { globalThis.fetch = originalFetch; }
});

test("timeout aborts the request and disabled Jev never calls the network", async () => {
  const originalFetch = globalThis.fetch;
  let aborted = false;
  try {
    globalThis.fetch = ((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
    })) as typeof fetch;
    const options = { apiKey: "test", config: { ...DEFAULT_CONFIG, jev: { ...DEFAULT_CONFIG.jev, timeoutMs: 10 } }, endpoint: "https://example.test", input: "fix login", agent: "claude" as const, repo };
    assert.equal((await analyzeWithJev(options)).source, "local-fallback");
    assert.equal(aborted, true);
    globalThis.fetch = (() => { assert.fail("disabled API must not be called"); }) as typeof fetch;
    options.config.jev.enabled = false;
    assert.equal((await analyzeWithJev(options)).source, "local-fallback");
  } finally { globalThis.fetch = originalFetch; }
});
