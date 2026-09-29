import path from "node:path";
const esc = "\u001b[";
const reset = `${esc}0m`;
const bold = `${esc}1m`;
const dim = `${esc}2m`;
const cyan = `${esc}36m`;
const green = `${esc}32m`;
const yellow = `${esc}33m`;
const magenta = `${esc}35m`;
const red = `${esc}31m`;
export const c = {
    bold: (s) => `${bold}${s}${reset}`,
    dim: (s) => `${dim}${s}${reset}`,
    cyan: (s) => `${cyan}${s}${reset}`,
    green: (s) => `${green}${s}${reset}`,
    yellow: (s) => `${yellow}${s}${reset}`,
    magenta: (s) => `${magenta}${s}${reset}`,
    red: (s) => `${red}${s}${reset}`,
};
export function agentLabel(agent) {
    return agent === "claude" ? c.cyan("Claude") : c.green("Codex");
}
export function renderLogo(columns = process.stdout.columns || 80, color = Boolean(process.stdout.isTTY)) {
    const rows = [
        "          ██╗                         ",
        "██╗  ██╗  ██║       █████╗  ██╗   ██╗",
        " ╚███╔╝   ██║      ██╔══██╗ ╚██╗ ██╔╝",
        " ██╔██╗   ██║      ███████║  ╚████╔╝ ",
        "██╔╝ ██╗  ███████╗ ██║  ██║   ╚██╔╝  ",
        "╚═╝  ╚═╝  ╚══════╝ ╚═╝  ╚═╝    ██║   ",
        "                               ╚═╝   ",
    ];
    const stops = [[77, 165, 232], [143, 126, 214], [213, 115, 153]];
    const selected = columns < 40 ? ["xLay"] : rows;
    return selected.map(row => Array.from(row).map((char, index) => {
        if (!color || char === " ")
            return char;
        const position = index / Math.max(1, row.length - 1) * 2;
        const segment = Math.min(1, Math.floor(position));
        const fraction = position - segment;
        const rgb = stops[segment].map((start, channel) => Math.round(start + (stops[segment + 1][channel] - start) * fraction));
        return `\u001b[38;2;${rgb.join(";")}m${char}`;
    }).join("") + (color ? reset : "")).join("\n");
}
export function printHeader(cwd, agent, jevReady) {
    const repo = path.basename(cwd) || cwd;
    const jev = jevReady ? c.green("Jev ✓") : c.yellow("Jev fallback");
    console.log();
    console.log(renderLogo());
    console.log();
    console.log(`${c.dim(repo)}  ·  ${agentLabel(agent)}  ·  ${jev}`);
    console.log(c.dim("/claude  /codex  /help  /exit"));
    console.log();
}
export function printAgentSwitch(agent) {
    console.log(`\n${c.dim("agent →")} ${agentLabel(agent)}\n`);
}
export function printJevSummary(decision, policy, candidateCount) {
    const source = decision.source === "api" ? "Jev" : "local";
    console.log(c.dim(`${source}: ${policy.dispatch} · ${policy.mode} · scope ${policy.scope} · context ${candidateCount}/${policy.contextLimit} · validation ${policy.validation}${policy.reasons.length ? ` · ${policy.reasons.join(", ")}` : ""}${decision.fallbackReason ? ` · ${decision.fallbackReason}` : ""}`));
}
export function printAgentTitle(agent) {
    console.log(`\n${agentLabel(agent)}\n`);
}
export function printError(message) {
    console.error(c.red(`xLay: ${message}`));
}
export function inputPrompt() {
    return `${c.bold(">")} `;
}
export function inputRule(columns = process.stdout.columns || 80) {
    return "─".repeat(Math.max(1, columns - 1));
}
//# sourceMappingURL=ui.js.map