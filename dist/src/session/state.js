export class ShellState {
    agent = "claude";
    claudeSessionId;
    codexThreadId;
    constructor(defaultAgent) {
        this.agent = defaultAgent;
    }
    get currentSessionId() {
        return this.agent === "claude" ? this.claudeSessionId : this.codexThreadId;
    }
    set currentSessionId(value) {
        if (this.agent === "claude")
            this.claudeSessionId = value;
        else
            this.codexThreadId = value;
    }
}
//# sourceMappingURL=state.js.map