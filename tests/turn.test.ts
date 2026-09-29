import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { prepareTurn } from "../src/turn.js";
import { DEFAULT_CONFIG } from "../src/config.js";

test("semantic selection reaches the prompt, skips unchanged excerpts and refreshes changes", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xlay-turn-"));
  const saved = globalThis.fetch;
  try {
    execFileSync("git", ["init", "-q", root]);
    for (const file of ["auth.ts", "billing.ts", "view.ts", "store.ts"]) fs.writeFileSync(path.join(root, file), `export const marker = '${file}';\n`.repeat(20));
    execFileSync("git", ["add", "."], { cwd: root });
    globalThis.fetch = (async (url, init) => {
      assert.equal(url, "https://api.typesafe.ai/v1/systemone");
      assert.ok(Buffer.byteLength(String(init?.body)) < 28000);
      const body = JSON.parse(String(init?.body));
      const ranking = Object.fromEntries(Object.entries(body.questions).filter(([id]) => id.startsWith("file_")).map(([id, q]: [string, any]) => [id, { type: "score", score: q.instructions.candidate_path === "auth.ts" ? 3 : 0, confidence: 0.95 }]));
      return new Response(JSON.stringify({ model: "jev-1.13.0", answers: {
        task_type: { type: "choice", choice: "bug_fix", confidence: 0.95 },
        action_mode: { type: "choice", choice: "act", confidence: 0.95 },
        scope: { type: "choice", choice: "focused", confidence: 0.95 },
        needs_validation: { type: "noul", noul: 1 },
        safe_to_compact: { type: "noul", noul: 0 },
        ambiguity: { type: "score", score: 0, confidence: 1 }, ...ranking,
      }, usage: { input_tokens: 400, output_tokens: 40 } }));
    }) as typeof fetch;
    const options = { input: "sửa đăng nhập, giữ nguyên giao diện", cwd: root, agent: "claude" as const, config: DEFAULT_CONFIG, apiKey: "test", endpoint: DEFAULT_CONFIG.jev.endpoint };
    const first = await prepareTurn(options);
    assert.deepEqual(first.repo.candidateFiles, ["auth.ts"]);
    assert.match(first.prompt!, /giữ nguyên giao diện/);
    assert.match(first.prompt!, /export const marker/);
    assert.ok(first.metrics.selectedChars < first.metrics.candidateChars);
    const seenContext = new Map(first.repo.candidates!.map(c => [c.path, c.fingerprint]));
    const next = await prepareTurn({ ...options, hasSession: true, seenContext });
    assert.equal(next.metrics.selectedChars, 0);
    assert.ok(next.metrics.reusedChars > 0);
    assert.doesNotMatch(next.prompt!, /export const marker/);
    const newSession = await prepareTurn({ ...options, seenContext });
    assert.ok(newSession.metrics.selectedChars > 0);
    fs.writeFileSync(path.join(root, "auth.ts"), "export const changed = true;");
    const changed = await prepareTurn({ ...options, hasSession: true, seenContext });
    assert.match(changed.prompt!, /changed/);
    globalThis.fetch = (() => { assert.fail("baseline cannot call Jev"); }) as typeof fetch;
    const baseline = await prepareTurn({ ...options, baseline: true });
    assert.equal(baseline.prompt, options.input);
    assert.deepEqual(baseline.repo.candidateFiles, []);
  } finally { globalThis.fetch = saved; fs.rmSync(root, { recursive: true, force: true }); }
});
