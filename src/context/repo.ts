import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { ContextCandidate, JevDecision, RepoContext } from "../types.js";
import { extractKeywords, scorePath } from "./keywords.js";

function git(cwd: string, args: string[]): { ok: boolean; stdout: string } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  return { ok: result.status === 0, stdout: result.stdout ?? "" };
}

export function collectRepoContext(cwd: string, userInput: string, maxFiles = 6): RepoContext {
  const rootResult = git(cwd, ["rev-parse", "--show-toplevel"]);
  const isGitRepo = rootResult.ok;
  const root = isGitRepo ? rootResult.stdout.trim() : cwd;
  const repoName = path.basename(root) || root;

  if (!isGitRepo || maxFiles <= 0) {
    return { repoName, root, cwd, isGitRepo, candidateFiles: [] };
  }

  const filesResult = git(root, ["ls-files", "-z"]);
  if (!filesResult.ok) {
    return { repoName, cwd, isGitRepo: true, candidateFiles: [] };
  }

  const keywords = extractKeywords(userInput);
  const files = filesResult.stdout.split("\0").filter(Boolean);
  const ranked = files
    .map((file) => ({ file, score: scorePath(file, keywords) + (userInput.includes(file) ? 1000 : 0) }))
    .filter((entry) => entry.score >= 0 && eligiblePath(entry.file))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, maxFiles)
    .map((entry) => entry.file);

  return {
    repoName,
    root,
    cwd,
    isGitRepo: true,
    candidateFiles: ranked,
  };
}

function eligiblePath(file: string): boolean {
  return !/(?:^|\/)(?:node_modules|dist|build|coverage|vendor|\.git)(?:\/|$)/i.test(file)
    && !/(?:^|\/)(?:\.env(?:\..*)?|credentials[^/]*|secrets?[^/]*|id_rsa|id_ed25519)$/i.test(file)
    && !/\.(?:lock|pem|key|p12|pfx|map|min\.js)$/i.test(file)
    && /\.(?:[cm]?[jt]sx?|py|rs|go|java|cs|cpp|c|h|rb|php|vue|svelte|css|html|md|json|ya?ml|toml)$/i.test(file);
}

// Only tracked, small text files inside the repository. No untracked files
// or symlink targets. This is a bounded shortlist, not a full repository upload.
export function collectCandidates(cwd: string, input: string): RepoContext {
  const repo = collectRepoContext(cwd, input, 32);
  const root = fs.realpathSync(repo.root ?? cwd);
  const keywords = extractKeywords(input);
  const candidates: ContextCandidate[] = [];
  for (const file of repo.candidateFiles) {
    if (candidates.length >= 16) break;
    const absolute = path.resolve(root, file);
    try {
      const relative = path.relative(root, fs.realpathSync(absolute));
      const stat = fs.lstatSync(absolute);
      if (relative.startsWith("..") || path.isAbsolute(relative) || stat.isSymbolicLink() || !stat.isFile() || stat.size > 128000) continue;
      const text = fs.readFileSync(absolute, "utf8");
      if (text.includes("\0")) continue;
      const lines = text.split(/\r?\n/);
      let best = 0;
      let bestScore = 0;
      for (let i = 0; i < lines.length; i++) {
        const score = keywords.filter(word => lines[i].toLowerCase().includes(word)).length;
        if (score > bestScore) { best = i; bestScore = score; }
      }
      const start = Math.max(0, best - 2);
      let excerpt = `${start + 1}: ${lines.slice(start, start + 12).join("\n")}`;
      while (Buffer.byteLength(excerpt) > 512) excerpt = excerpt.slice(0, -1);
      candidates.push({ path: file, excerpt, fingerprint: createHash("sha256").update(text).digest("hex"), explicit: input.includes(file), localScore: scorePath(file, keywords) });
    } catch { /* Missing or inaccessible candidates must not block a turn. */ }
  }
  return { ...repo, candidates, candidateFiles: candidates.map(candidate => candidate.path) };
}

export function selectCandidates(candidates: ContextCandidate[], decision: JevDecision, limit: number): ContextCandidate[] {
  const scored = candidates.map((candidate, order) => {
    const answer = decision.relevance?.[candidate.path];
    return { candidate, order, answer: answer && answer.confidence >= 0.7 ? answer : undefined };
  });
  // Uncertain/missing rankings preserve local candidates instead of suppressing context.
  return scored.filter(item => item.candidate.explicit || (decision.source !== "local-fallback" || item.candidate.localScore !== 0)
      && (!item.answer || item.answer.score >= 1.5))
    .sort((a, b) => Number(b.candidate.explicit) - Number(a.candidate.explicit)
      || (b.answer?.score ?? 1.5) - (a.answer?.score ?? 1.5) || a.order - b.order)
    .slice(0, limit).map(item => item.candidate);
}
