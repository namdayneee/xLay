import fs from "node:fs";
import path from "node:path";
import { getPaths } from "./config.js";
import type { AgentName, JevDecision, TurnPolicy, TurnMetrics } from "./types.js";
import { normalizeUsage } from "./metrics.js";

export function appendHistory(entry: {
  agent: AgentName;
  decision: JevDecision;
  repo: string;
  exitCode?: number;
  policy: TurnPolicy;
  usage?: Record<string, unknown>;
  metrics?: TurnMetrics;
  durationMs?: number;
  mode?: "baseline" | "optimized";
  taskId?: string;
}): void {
  try {
    const file = path.join(getPaths().home, "history.jsonl");
    fs.appendFileSync(
      file,
      `${JSON.stringify({
        at: new Date().toISOString(),
        agent: entry.agent,
        repo: entry.repo,
        taskType: entry.decision.taskType.value,
        taskConfidence: entry.decision.taskType.confidence,
        jevSource: entry.decision.source,
        jevUsage: entry.decision.usage,
        jevModel: entry.decision.model,
        jevAttempted: entry.decision.apiAttempted,
        fallbackReason: entry.decision.fallbackReason,
        policy: entry.policy,
        agentUsage: entry.usage,
        tokens: normalizeUsage(entry.agent, entry.usage),
        metrics: entry.metrics,
        durationMs: entry.durationMs,
        mode: entry.mode ?? "optimized",
        taskId: entry.taskId,
        exitCode: entry.exitCode,
      })}\n`,
      "utf8",
    );
  } catch {
    // History must never break a coding session.
  }
}
