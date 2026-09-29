import { runClaude } from "./claude.js";
import { runCodex } from "./codex.js";
export async function runAgent(agent, prompt, cwd, sessionId, approve, signal) {
    if (agent === "claude")
        return await runClaude(prompt, cwd, sessionId, approve, undefined, signal);
    return await runCodex(prompt, cwd, sessionId, approve, undefined, signal);
}
//# sourceMappingURL=index.js.map