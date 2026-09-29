import { c } from "../ui.js";
import { printResponse } from "../markdown.js";
import { denyApproval } from "../approvals.js";
import { runChannel } from "./channel.js";
export async function runClaude(prompt, cwd, sessionId, approve = denyApproval, transport = runChannel, signal) {
    const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--permission-prompt-tool", "stdio"];
    if (sessionId)
        args.push("--resume", sessionId);
    let discoveredSessionId = sessionId;
    let usage;
    let emittedAssistant = false;
    let completed = false;
    let failed = false;
    let initialization;
    const pending = new Map();
    const handled = new Set();
    try {
        const exitCode = await transport({
            command: "claude", args, cwd, signal,
            start(channel) {
                initialization = setTimeout(() => channel.fail(new Error("Claude permission protocol initialization timed out. Update Claude Code and try again.")), 30000);
                channel.send({ type: "control_request", request_id: "xlay-init", request: { subtype: "initialize" } });
            },
            async receive(event, channel) {
                if (event.type === "control_response" && event.response?.request_id === "xlay-init") {
                    clearTimeout(initialization);
                    if (event.response.subtype !== "success")
                        throw new Error("Claude could not initialize the permission channel.");
                    channel.send({ type: "user", session_id: sessionId ?? "", message: { role: "user", content: prompt }, parent_tool_use_id: null });
                    return;
                }
                if (event.type === "control_cancel_request") {
                    pending.get(event.request_id)?.abort();
                    return;
                }
                if (event.type === "control_request") {
                    const id = event.request_id;
                    if (typeof id !== "string" || handled.has(id))
                        return;
                    handled.add(id);
                    const request = event.request;
                    if (request?.subtype !== "can_use_tool" || typeof request.tool_name !== "string" || !request.input || typeof request.input !== "object") {
                        channel.send({ type: "control_response", response: { subtype: "error", request_id: id, error: "Unsupported control request" } });
                        return;
                    }
                    const controller = new AbortController();
                    const abort = () => controller.abort();
                    channel.signal.addEventListener("abort", abort, { once: true });
                    pending.set(id, controller);
                    try {
                        const allowed = await approve({ agent: "claude", title: request.title ?? request.tool_name,
                            details: { tool: request.tool_name, reason: request.decision_reason, input: request.input } }, controller.signal);
                        if (!controller.signal.aborted)
                            channel.send({ type: "control_response", response: {
                                    subtype: "success", request_id: id,
                                    response: allowed ? { behavior: "allow", updatedInput: request.input }
                                        : { behavior: "deny", message: "The user declined this action. Do not retry it without a new request." },
                                } });
                    }
                    finally {
                        pending.delete(id);
                        channel.signal.removeEventListener("abort", abort);
                    }
                    return;
                }
                if (typeof event.session_id === "string")
                    discoveredSessionId = event.session_id;
                if (event.type === "assistant" && Array.isArray(event.message?.content)) {
                    for (const block of event.message.content) {
                        if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
                            printResponse(block.text);
                            emittedAssistant = true;
                        }
                        if (block.type === "tool_use" && typeof block.name === "string")
                            console.log(c.dim(`↳ ${block.name}`));
                    }
                }
                if (event.type === "result") {
                    completed = true;
                    failed = Boolean(event.is_error);
                    if (event.usage && typeof event.usage === "object")
                        usage = event.usage;
                    if (!emittedAssistant && typeof event.result === "string" && event.result.trim())
                        printResponse(event.result);
                    if (Array.isArray(event.permission_denials) && event.permission_denials.length) {
                        console.log(c.yellow("Claude từ chối một số thao tác theo cấu hình quyền hiện tại. Đồng ý trong chat không thay đổi cấu hình đó."));
                    }
                    channel.finish();
                }
            },
            stderr(line) { if (line.trim())
                console.error(c.dim(line)); },
        });
        return { sessionId: discoveredSessionId, exitCode: failed || !completed ? exitCode || 1 : exitCode, usage };
    }
    finally {
        clearTimeout(initialization);
        for (const controller of pending.values())
            controller.abort();
    }
}
//# sourceMappingURL=claude.js.map