import { c } from "../ui.js";
import { printResponse } from "../markdown.js";
import { denyApproval } from "../approvals.js";
import { runChannel } from "./channel.js";
export async function runCodex(prompt, cwd, sessionId, approve = denyApproval, transport = runChannel, signal) {
    let discoveredSessionId = sessionId;
    let turnId;
    let completed = false;
    let failed = false;
    let usage;
    let startup;
    const items = new Map();
    const pending = new Map();
    const handled = new Set();
    try {
        const exitCode = await transport({
            command: "codex", args: ["app-server"], cwd, signal,
            start(channel) {
                startup = setTimeout(() => channel.fail(new Error("Codex app-server initialization timed out. Update Codex CLI and try again.")), 30000);
                channel.send({ id: "xlay-init", method: "initialize", params: { clientInfo: { name: "xlay", title: "xLay", version: "1.0.0" } } });
            },
            async receive(event, channel) {
                if (event.error && ["xlay-init", "xlay-thread", "xlay-turn"].includes(event.id)) {
                    throw new Error(`Codex app-server: ${event.error.message}. A CLI supporting thread/start and thread/resume is required; update Codex CLI. No permission settings were changed.`);
                }
                if (event.id === "xlay-init" && event.result) {
                    channel.send({ method: "initialized", params: {} });
                    channel.send({ id: "xlay-thread", method: sessionId ? "thread/resume" : "thread/start", params: { cwd, ...(sessionId ? { threadId: sessionId } : {}) } });
                    return;
                }
                if (event.id === "xlay-thread" && event.result) {
                    if (typeof event.result.thread?.id !== "string")
                        throw new Error("Codex returned no thread id.");
                    discoveredSessionId = event.result.thread.id;
                    channel.send({ id: "xlay-turn", method: "turn/start", params: { threadId: discoveredSessionId, input: [{ type: "text", text: prompt }] } });
                    return;
                }
                if (event.id === "xlay-turn" && event.result) {
                    clearTimeout(startup);
                    turnId = event.result.turn?.id;
                    return;
                }
                const p = event.params ?? {};
                if (event.method === "serverRequest/resolved") {
                    pending.get(p.requestId)?.abort();
                    return;
                }
                if (event.id !== undefined && typeof event.method === "string") {
                    if (handled.has(event.id))
                        return;
                    handled.add(event.id);
                    const permission = event.method === "item/permissions/requestApproval";
                    const command = event.method === "item/commandExecution/requestApproval";
                    const file = event.method === "item/fileChange/requestApproval";
                    if (!permission && !command && !file) {
                        channel.send({ id: event.id, error: { code: -32601, message: "xLay does not support this interactive request" } });
                        return;
                    }
                    const controller = new AbortController();
                    const abort = () => controller.abort();
                    channel.signal.addEventListener("abort", abort, { once: true });
                    pending.set(event.id, controller);
                    try {
                        const sameTurn = p.threadId === discoveredSessionId && (!turnId || p.turnId === turnId);
                        const canAccept = !command || !Array.isArray(p.availableDecisions) || p.availableDecisions.includes("accept");
                        const allowed = sameTurn && canAccept && await approve({ agent: "codex", title: permission ? "Cấp quyền cho lượt này" : file ? "Thay đổi file" : "Chạy lệnh",
                            details: { ...p, ...(items.has(p.itemId) ? { proposed: items.get(p.itemId) } : {}) } }, controller.signal);
                        if (!controller.signal.aborted)
                            channel.send({ id: event.id, result: permission
                                    ? { permissions: allowed ? p.permissions ?? {} : {}, scope: "turn" }
                                    : { decision: allowed ? "accept" : "decline" } });
                    }
                    finally {
                        pending.delete(event.id);
                        channel.signal.removeEventListener("abort", abort);
                    }
                    return;
                }
                if (p.threadId && p.threadId !== discoveredSessionId)
                    return;
                if (event.method === "turn/started") {
                    clearTimeout(startup);
                    turnId = p.turn?.id;
                }
                if (event.method === "item/started" && p.item?.id)
                    items.set(p.item.id, p.item);
                if (event.method === "item/completed") {
                    const item = p.item ?? {};
                    if (item.type === "agentMessage" && typeof item.text === "string")
                        printResponse(item.text);
                    else if (item.type === "commandExecution")
                        console.log(c.dim(`↳ ${item.command ?? "command"}`));
                    else if (item.type === "fileChange")
                        console.log(c.dim(`↳ file change (${item.changes?.length ?? 0})`));
                    items.delete(item.id);
                }
                if (event.method === "thread/tokenUsage/updated") {
                    const last = p.tokenUsage?.last;
                    if (last)
                        usage = { input_tokens: last.inputTokens, output_tokens: last.outputTokens, cached_input_tokens: last.cachedInputTokens };
                }
                if (event.method === "error" && typeof p.error?.message === "string")
                    console.error(p.error.message);
                if (event.method === "turn/completed") {
                    completed = true;
                    failed = p.turn?.status !== "completed";
                    if (p.turn?.error?.message)
                        console.error(p.turn.error.message);
                    channel.finish();
                }
            },
            stderr(line) { if (line.trim())
                console.error(c.dim(line)); },
        });
        return { sessionId: discoveredSessionId, exitCode: failed || !completed ? exitCode || 1 : exitCode, usage };
    }
    finally {
        clearTimeout(startup);
        for (const controller of pending.values())
            controller.abort();
    }
}
//# sourceMappingURL=codex.js.map