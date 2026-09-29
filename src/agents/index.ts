import type { AgentName, AgentRunResult } from "../types.js";
import { runClaude } from "./claude.js";
import { runCodex } from "./codex.js";
import type { Approve } from "../approvals.js";

export async function runAgent(
  agent: AgentName,
  prompt: string,
  cwd: string,
  sessionId?: string,
  approve?: Approve,
  signal?: AbortSignal,
): Promise<AgentRunResult> {
  if (agent === "claude") return await runClaude(prompt, cwd, sessionId, approve, undefined, signal);
  return await runCodex(prompt, cwd, sessionId, approve, undefined, signal);
}
