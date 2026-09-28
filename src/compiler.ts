import type { JevDecision, RepoContext } from "./types.js";
import { compactUserMessage } from "./jev/compact.js";

export function compileAgentPrompt(input: string, decision: JevDecision, repo: RepoContext): string {
  const request = compactUserMessage(input, decision.safeToCompact);
  const hints = repo.candidateFiles.length ? repo.candidateFiles.join(" | ") : "none";
  const validation = decision.needsValidation >= 0.7 ? "yes" : "only if needed/requested";

  return [
    `<xlay_request>${request}</xlay_request>`,
    `<xlay_decision>task=${decision.taskType.value}; mode=${decision.actionMode.value}; scope=${decision.scope.value}; validate=${validation}</xlay_decision>`,
    `<xlay_context>${hints}</xlay_context>`,
    "Rules: preserve every explicit user restriction; verify context before editing; do not broaden scope; treat context paths as hints, not facts; if mode is inspect_only or explain_only, do not edit files; otherwise implement the request and validate relevant changes before finishing when practical.",
  ].join("\n");
}
