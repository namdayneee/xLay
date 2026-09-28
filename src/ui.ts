import path from "node:path";
import type { AgentName, JevDecision } from "./types.js";

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

export function printHeader(cwd: string, agent: AgentName, jevReady: boolean): void {
  const repo = path.basename(cwd) || cwd;
  const jev = jevReady ? c.green("Jev ✓") : c.yellow("Jev fallback");
  console.log();
  console.log(c.bold("xLay"));
  console.log(`${c.dim(repo)}  ·  ${agentLabel(agent)}  ·  ${jev}`);
  console.log(c.dim("/claude  /codex  /help  /exit"));
  console.log();
}

export function printAgentSwitch(agent: AgentName): void {
  console.log(`\n${c.dim("agent →")} ${agentLabel(agent)}\n`);
}

export function printJevSummary(decision: JevDecision, candidateCount: number): void {
  const pct = Math.round(decision.taskType.confidence * 100);
  const source = decision.source === "api" ? "Jev" : "local";
  console.log(
    c.dim(
      `${source}: ${decision.taskType.value} ${pct}% · scope ${decision.scope.value} · context ${candidateCount}`,
    ),
  );
}

export function printAgentTitle(agent: AgentName): void {
  console.log(`\n${agentLabel(agent)}\n`);
}

export function printError(message: string): void {
  console.error(c.red(`xLay: ${message}`));
}

export function printInputTop(): void {
  console.log(c.dim("╭─ message ─────────────────────────────────────────"));
}

export function inputPrompt(): string {
  return `${c.dim("│")} ${c.bold("›")} `;
}

export function printInputBottom(): void {
  console.log(c.dim("╰───────────────────────────────────────────────────"));
}
