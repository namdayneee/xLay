import { runClaude } from "./claude.js";
import { runCodex } from "./codex.js";
export async function runAgent(agent, prompt, cwd, sessionId) {
    if (agent === "claude")
        return await runClaude(prompt, cwd, sessionId);
    return await runCodex(prompt, cwd, sessionId);
}
//# sourceMappingURL=index.js.map