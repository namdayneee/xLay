import { stdin as input, stdout as output } from "node:process";
import { createHash } from "node:crypto";
import { normalizeUsage } from "./metrics.js";
import { runAgent } from "./agents/index.js";
import { loadConfig, resolveJevApiKey, resolveJevEndpoint } from "./config.js";
import { appendHistory } from "./history.js";
import { prepareTurn } from "./turn.js";
import { commandExists } from "./process.js";
import { ShellState } from "./session/state.js";
import { ShellInput } from "./input.js";
import { c, printAgentSwitch, printAgentTitle, printError, printHeader, printJevSummary, } from "./ui.js";
function normalizeCommand(value) {
    const v = value.trim().toLowerCase();
    if (["/claude", "claude"].includes(v))
        return "/claude";
    if (["/codex", "codex"].includes(v))
        return "/codex";
    if (["/exit", "exit", "quit", "/quit"].includes(v))
        return "/exit";
    if (["/help", "help"].includes(v))
        return "/help";
    return "";
}
export async function runShell(cwd = process.cwd()) {
    const config = loadConfig();
    const apiKey = resolveJevApiKey();
    const endpoint = resolveJevEndpoint(config);
    const state = new ShellState(config.defaultAgent);
    const reader = new ShellInput(input, output);
    const pending = {};
    const contextMemory = new Map();
    const baseline = process.env.XLAY_BENCHMARK_BASELINE === "1";
    printHeader(cwd, state.agent, config.jev.enabled && Boolean(apiKey));
    if (baseline)
        console.log(c.yellow("Benchmark baseline: requests are forwarded verbatim; Jev/context optimization is off."));
    while (true) {
        const raw = await reader.read();
        if (raw === undefined)
            break;
        const message = raw.trim();
        if (!message)
            continue;
        const command = normalizeCommand(message);
        if (command === "/exit")
            break;
        if (command === "/help") {
            console.log(`\n${c.bold("Commands")}\n/claude  use Claude Code\n/codex   use Codex\n/help    show commands\n/exit    close xLay\n`);
            continue;
        }
        if (command === "/claude" || command === "/codex") {
            state.agent = command === "/claude" ? "claude" : "codex";
            printAgentSwitch(state.agent);
            continue;
        }
        if (!commandExists(state.agent)) {
            printError(`${state.agent} CLI was not found. Install/login to it first, or switch agent.`);
            continue;
        }
        const request = pending[state.agent]
            ? `${pending[state.agent]}\n\nUser clarification:\n${raw}` : raw;
        const startedAt = Date.now();
        const taskId = createHash("sha256").update(`${cwd}\0${state.agent}\0${request}`).digest("hex");
        const memoryKey = `${state.agent}:${state.currentSessionId ?? ""}`;
        const { repo, decision, policy, prompt, metrics } = await prepareTurn({
            apiKey,
            config,
            endpoint,
            input: request,
            agent: state.agent,
            cwd,
            hasSession: Boolean(state.currentSessionId),
            seenContext: contextMemory.get(memoryKey),
            baseline,
        });
        printJevSummary(decision, policy, repo.candidateFiles.length);
        if (prompt === undefined) {
            pending[state.agent] = request;
            appendHistory({ agent: state.agent, decision, policy, repo: repo.repoName, metrics, taskId });
            console.log("xLay: Please clarify the target, desired outcome, and whether to edit or inspect. Your original request is retained; the next message adds clarification.");
            continue;
        }
        delete pending[state.agent];
        printAgentTitle(state.agent);
        try {
            const result = await runAgent(state.agent, prompt, repo.cwd, state.currentSessionId);
            state.currentSessionId = result.sessionId;
            if (result.exitCode === 0 && result.sessionId) {
                const key = `${state.agent}:${result.sessionId}`;
                const remembered = contextMemory.get(key) ?? new Map();
                for (const candidate of repo.candidates ?? [])
                    if (candidate.excerpt)
                        remembered.set(candidate.path, candidate.fingerprint);
                contextMemory.set(key, remembered);
            }
            appendHistory({ agent: state.agent, decision, policy, repo: repo.repoName, exitCode: result.exitCode,
                usage: result.usage, metrics, taskId, mode: baseline ? "baseline" : "optimized", durationMs: Date.now() - startedAt });
            const tokens = normalizeUsage(state.agent, result.usage);
            console.log(c.dim(`usage: ${tokens ? `${tokens.input} input (${tokens.cached} cached), ${tokens.output} output` : "unavailable"} · context ${metrics.selectedChars}/${metrics.candidateChars} chars · reused ${metrics.reusedChars}`));
            if (result.exitCode !== 0)
                printError(`${state.agent} exited with code ${result.exitCode}.`);
        }
        catch (error) {
            printError(error instanceof Error ? error.message : String(error));
        }
        console.log();
    }
    reader.close();
    console.log(c.dim("xLay closed."));
}
//# sourceMappingURL=shell.js.map