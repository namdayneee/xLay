import { analyzeWithJev } from "./jev/client.js";
import { collectCandidates, collectRepoContext, selectCandidates } from "./context/repo.js";
import { resolvePolicy } from "./policy.js";
import { compileAgentPrompt } from "./compiler.js";
import { localFallbackDecision } from "./jev/fallback.js";
export async function prepareTurn(options) {
    if (options.baseline) {
        const repo = collectRepoContext(options.cwd, options.input, 0);
        const decision = { ...localFallbackDecision(options.input, options.hasSession), fallbackReason: "benchmark-baseline" };
        const policy = resolvePolicy(options.input, decision, 0);
        policy.dispatch = "run";
        return { repo, decision, policy, prompt: options.input, metrics: {
                requestChars: options.input.length, promptChars: options.input.length, candidateChars: 0,
                selectedChars: 0, reusedChars: 0, selectedFiles: 0, contextSource: "local",
            } };
    }
    const snapshot = collectCandidates(options.cwd, options.input);
    const decision = await analyzeWithJev({ ...options, repo: snapshot });
    const policy = resolvePolicy(options.input, decision, options.config.context.maxCandidateFiles);
    const selected = policy.dispatch === "run" ? selectCandidates(snapshot.candidates ?? [], decision, policy.contextLimit) : [];
    let budget = 2400;
    let reusedChars = 0;
    const candidates = selected.map(candidate => {
        if (options.hasSession && options.seenContext?.get(candidate.path) === candidate.fingerprint) {
            reusedChars += candidate.excerpt.length;
            return { ...candidate, excerpt: "" };
        }
        const excerpt = candidate.excerpt.slice(0, budget);
        budget -= excerpt.length;
        return { ...candidate, excerpt };
    });
    const repo = { ...snapshot, candidates, candidateFiles: candidates.map(candidate => candidate.path) };
    const prompt = policy.dispatch === "run" ? compileAgentPrompt(options.input, policy, repo) : undefined;
    const metrics = {
        requestChars: options.input.length, promptChars: prompt?.length ?? 0,
        candidateChars: (snapshot.candidates ?? []).reduce((sum, candidate) => sum + candidate.excerpt.length, 0),
        selectedChars: candidates.reduce((sum, candidate) => sum + candidate.excerpt.length, 0),
        reusedChars, selectedFiles: candidates.length,
        contextSource: Object.values(decision.relevance ?? {}).some(answer => answer.confidence >= 0.7) ? "jev" : "local",
    };
    return { decision, policy, repo, prompt, metrics };
}
//# sourceMappingURL=turn.js.map