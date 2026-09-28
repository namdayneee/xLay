import type { AgentName } from "../types.js";

export class ShellState {
  agent: AgentName = "claude";
  claudeSessionId?: string;
  codexThreadId?: string;

  constructor(defaultAgent: AgentName) {
    this.agent = defaultAgent;
  }

  get currentSessionId(): string | undefined {
    return this.agent === "claude" ? this.claudeSessionId : this.codexThreadId;
  }

  set currentSessionId(value: string | undefined) {
    if (this.agent === "claude") this.claudeSessionId = value;
    else this.codexThreadId = value;
  }
}
