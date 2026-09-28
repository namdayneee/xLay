import path from "node:path";
import { spawnSync } from "node:child_process";
import { extractKeywords, scorePath } from "./keywords.js";
function git(cwd, args) {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        windowsHide: true,
    });
    return { ok: result.status === 0, stdout: result.stdout ?? "" };
}
export function collectRepoContext(cwd, userInput, maxFiles = 6) {
    const rootResult = git(cwd, ["rev-parse", "--show-toplevel"]);
    const isGitRepo = rootResult.ok;
    const root = isGitRepo ? rootResult.stdout.trim() : cwd;
    const repoName = path.basename(root) || root;
    if (!isGitRepo) {
        return { repoName, cwd, isGitRepo: false, candidateFiles: [] };
    }
    const filesResult = git(root, ["ls-files"]);
    if (!filesResult.ok) {
        return { repoName, cwd: root, isGitRepo: true, candidateFiles: [] };
    }
    const keywords = extractKeywords(userInput);
    const files = filesResult.stdout.split(/\r?\n/).filter(Boolean);
    const ranked = files
        .map((file) => ({ file, score: scorePath(file, keywords) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
        .slice(0, maxFiles)
        .map((entry) => entry.file);
    return {
        repoName,
        cwd: root,
        isGitRepo: true,
        candidateFiles: ranked,
    };
}
//# sourceMappingURL=repo.js.map