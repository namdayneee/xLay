import type { AgentRunResult } from "../types.js";
import { spawnLines } from "../process.js";
import { c } from "../ui.js";

function shortCommand(value: string): string {
  return value.length <= 90 ? value : `${value.slice(0, 87)}...`;
}

export async function runCodex(
  prompt: string,
  cwd: string,
  sessionId?: string,
): Promise<AgentRunResult> {
  const args = ["exec", "--json", "--color", "never"];
  if (sessionId) args.push("resume", sessionId, "-");

  let discoveredSessionId = sessionId;
  let usage: Record<string, unknown> | undefined;

  const exitCode = await spawnLines({
    command: "codex",
    args,
    cwd,
    stdinData: prompt,
    onStdoutLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const event = JSON.parse(trimmed) as any;
        if (event.type === "thread.started" && typeof event.thread_id === "string") {
          discoveredSessionId = event.thread_id;
        }
        if (event.type === "item.completed") {
          const item = event.item ?? {};
          if (item.type === "agent_message" && typeof item.text === "string") {
            console.log(item.text.trim());
          } else if (item.type === "command_execution" && typeof item.command === "string") {
            console.log(c.dim(`↳ ${shortCommand(item.command)}`));
          } else if (item.type === "file_change") {
            const count = Array.isArray(item.changes) ? item.changes.length : 1;
            console.log(c.dim(`↳ file change (${count})`));
          } else if (item.type === "error" && typeof item.message === "string") {
            console.error(item.message);
          }
        }
        if (event.type === "turn.completed" && event.usage && typeof event.usage === "object") {
          usage = event.usage;
        }
        if (event.type === "turn.failed") {
          const message = event.error?.message;
          if (typeof message === "string") console.error(message);
        }
      } catch {
        console.log(trimmed);
      }
    },
    onStderrLine(line) {
      if (line.trim()) console.error(c.dim(line));
    },
  });

  return { sessionId: discoveredSessionId, exitCode, usage };
}
