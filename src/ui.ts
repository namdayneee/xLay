import path from "node:path";
import type { AgentName, JevDecision, TurnPolicy } from "./types.js";

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
  bold: (s: string) => `${bold}${s}${reset}`,
  dim: (s: string) => `${dim}${s}${reset}`,
  cyan: (s: string) => `${cyan}${s}${reset}`,
  green: (s: string) => `${green}${s}${reset}`,
  yellow: (s: string) => `${yellow}${s}${reset}`,
  magenta: (s: string) => `${magenta}${s}${reset}`,
  red: (s: string) => `${red}${s}${reset}`,
};

export function agentLabel(agent: AgentName): string {
  return agent === "claude" ? c.cyan("Claude") : c.green("Codex");
}

export function renderLogo(columns = process.stdout.columns || 80, color = Boolean(process.stdout.isTTY)): string {
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
    if (!color || char === " ") return char;
    const position = index / Math.max(1, row.length - 1) * 2;
    const segment = Math.min(1, Math.floor(position));
    const fraction = position - segment;
    const rgb = stops[segment].map((start, channel) => Math.round(start + (stops[segment + 1][channel] - start) * fraction));
    return `\u001b[38;2;${rgb.join(";")}m${char}`;
  }).join("") + (color ? reset : "")).join("\n");
}

export function printHeader(cwd: string, agent: AgentName, jevReady: boolean): void {
  const repo = path.basename(cwd) || cwd;
  const jev = jevReady ? c.green("Jev ✓") : c.yellow("Jev fallback");
  console.log();
  console.log(renderLogo());
  console.log();
  console.log(`${c.dim(repo)}  ·  ${agentLabel(agent)}  ·  ${jev}`);
  console.log(c.dim("/claude  /codex  /help  /exit"));
  console.log();
}

export function printAgentSwitch(agent: AgentName): void {
  console.log(`\n${c.dim("agent →")} ${agentLabel(agent)}\n`);
}

export function printJevSummary(decision: JevDecision, policy: TurnPolicy, candidateCount: number): void {
  const source = decision.source === "api" ? "Jev" : "local";
  console.log(
    c.dim(
      `${source}: ${policy.dispatch} · ${policy.mode} · scope ${policy.scope} · context ${candidateCount}/${policy.contextLimit} · validation ${policy.validation}${policy.reasons.length ? ` · ${policy.reasons.join(", ")}` : ""}${decision.fallbackReason ? ` · ${decision.fallbackReason}` : ""}`,
    ),
  );
}

export function printAgentTitle(agent: AgentName): void {
  console.log(`\n${agentLabel(agent)}\n`);
}

export function printError(message: string): void {
  console.error(c.red(`xLay: ${message}`));
}

export function inputPrompt(): string {
  return `${c.bold(">")} `;
}

export function inputRule(columns = process.stdout.columns || 80): string {
  return "─".repeat(Math.max(1, columns - 1));
}
