const count = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
// Codex input includes cached tokens. Claude reports cache reads/writes separately.
// Missing usage is unknown, never an invented zero or a chars/4 estimate.
export function normalizeUsage(agent, usage) {
    if (!count(usage?.input_tokens) || !count(usage?.output_tokens))
        return undefined;
    const cached = agent === "claude" ? usage.cache_read_input_tokens : usage.cached_input_tokens;
    const writes = agent === "claude" ? usage.cache_creation_input_tokens : 0;
    const cacheTokens = count(cached) ? cached : 0;
    const input = usage.input_tokens + (agent === "claude" ? cacheTokens + (count(writes) ? writes : 0) : 0);
    return { input, output: usage.output_tokens, cached: cacheTokens, total: input + usage.output_tokens };
}
//# sourceMappingURL=metrics.js.map