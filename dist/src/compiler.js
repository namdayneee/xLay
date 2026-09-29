import { compactUserMessage } from "./jev/compact.js";
export function compileAgentPrompt(input, policy, repo) {
    if (policy.dispatch !== "run")
        throw new Error("Cannot compile a turn awaiting clarification");
    const request = compactUserMessage(input, policy.compact ? 1 : 0);
    const hints = repo.candidateFiles.slice(0, policy.contextLimit);
    return [
        `xLay: mode=${policy.mode}; scope=${policy.scope}. User constraints prevail.`,
        policy.mode === "act" ? "Validate relevant changes if permitted." : "Read only; no mutations.",
        ...(policy.mode !== "act" && policy.validation === "relevant" ? ["Validate only if permitted and non-mutating."] : []),
        ...(hints.length ? [
            `Hints relative to ${JSON.stringify(repo.root ?? repo.cwd)}; verify before editing, expand search if insufficient:`,
            JSON.stringify(repo.candidates?.slice(0, policy.contextLimit).map(({ path, excerpt }) => ({ path, ...(excerpt ? { excerpt } : {}) })) ?? hints),
        ] : []),
        "Request:",
        request,
    ].join("\n");
}
//# sourceMappingURL=compiler.js.map