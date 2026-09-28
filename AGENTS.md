# xLay agent guide

Keep xLay small and terminal-first.

Project invariants:
- `xlay` opens the interactive shell; do not make one-shot quoted prompts the primary UX.
- Claude Code is the default agent.
- `/codex` switches to Codex and `/claude` switches back.
- Keep a separate resumable session id for each agent in the current xLay shell.
- Jev is a decision layer, not a text generator. Do not ask Jev to rewrite user prompts.
- Preserve explicit user constraints. Compaction may remove only low-risk filler wording.
- Context paths are hints only; agents must verify before editing.
- Never add flags that bypass agent sandbox or approval protections by default.
- Prefer Node built-ins and zero runtime dependencies.
- Keep CLI commands minimal.
- Add or update tests for intent compaction, context ranking, prompt compilation, and fallback behavior when changing these layers.
