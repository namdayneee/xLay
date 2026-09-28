import { spawnLines } from "../process.js";
import { c } from "../ui.js";
import { printResponse } from "../markdown.js";
function textBlocks(content) {
    if (!Array.isArray(content))
        return [];
    return content
        .filter((block) => block?.type === "text" && typeof block.text === "string")
        .map((block) => block.text);
}
export async function runClaude(prompt, cwd, sessionId) {
    const args = ["-p", "--output-format", "stream-json", "--verbose"];
    if (sessionId)
        args.push("--resume", sessionId);
    let discoveredSessionId = sessionId;
    let usage;
    let emittedAssistant = false;
    const exitCode = await spawnLines({
        command: "claude",
        args,
        cwd,
        stdinData: prompt,
        onStdoutLine(line) {
            const trimmed = line.trim();
            if (!trimmed)
                return;
            try {
                const event = JSON.parse(trimmed);
                if (typeof event.session_id === "string")
                    discoveredSessionId = event.session_id;
                if (event.type === "assistant") {
                    const texts = textBlocks(event.message?.content);
                    for (const text of texts) {
                        if (!text.trim())
                            continue;
                        printResponse(text);
                        emittedAssistant = true;
                    }
                    const toolUses = Array.isArray(event.message?.content)
                        ? event.message.content.filter((b) => b?.type === "tool_use")
                        : [];
                    for (const tool of toolUses) {
                        if (typeof tool.name === "string")
                            console.log(c.dim(`↳ ${tool.name}`));
                    }
                }
                if (event.type === "result") {
                    if (event.usage && typeof event.usage === "object")
                        usage = event.usage;
                    if (!emittedAssistant && typeof event.result === "string" && event.result.trim()) {
                        printResponse(event.result);
                    }
                }
            }
            catch {
                console.log(trimmed);
            }
        },
        onStderrLine(line) {
            if (line.trim())
                console.error(c.dim(line));
        },
    });
    return { sessionId: discoveredSessionId, exitCode, usage };
}
//# sourceMappingURL=claude.js.map