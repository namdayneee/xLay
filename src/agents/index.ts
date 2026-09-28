import type { AgentName, AgentRunResult } from "../types.js";
import { runClaude } from "./claude.js";
import { runCodex } from "./codex.js";

export async function runAgent(
  agent: AgentName,
  prompt: string,
  cwd: string,
  sessionId?: string,
): Promise<AgentRunResult> {
  if (agent === "claude") return await runClaude(prompt, cwd, sessionId);
  return await runCodex(prompt, cwd, sessionId);
}
