# xLay

xLay is an interactive terminal layer in front of Claude Code and Codex. You open it once with `xlay`, type naturally in a chat-like prompt, and xLay uses Jev decisions plus lightweight repository context selection before forwarding a compact task to the selected coding agent.

## Daily UX

```text
xLay
Matavi · Claude · Jev ✓
/claude  /codex  /help  /exit

╭─ message ─────────────────────────────────────────
│ › sửa login, giữ nguyên UI và đừng đổi database
╰───────────────────────────────────────────────────
Jev: bug_fix 96% · scope minimal · context 4

Claude
...
```

Claude is the default. Type `/codex` (or simply `codex`) to switch to Codex. Type `/claude` to switch back. xLay keeps a separate resumable session id for each agent during the shell session.

## Requirements

- Node.js 20+
- Git
- Claude Code CLI for Claude usage
- Codex CLI for Codex usage
- Jev API key for Jev-backed decisions (optional at first; local fallback exists)

## Install locally

```bash
npm install
npm run check
npm run build
npm link
xlay setup
xlay doctor
```

Then enter any Git repository and run:

```bash
xlay
```

## Commands

Outside chat:

```text
xlay          interactive shell
xlay setup    one-time Jev setup
xlay doctor   environment check
```

Inside chat:

```text
/claude       switch to Claude Code (default)
/codex        switch to Codex
/help         show commands
/exit         close xLay
```

## Jev

The default endpoint is `https://jev-api.org/api/v1/decisions`. You can override it with `JEV_API_URL`. The API key can be stored by `xlay setup` or supplied through `JEV_API_KEY`.

xLay asks Jev for typed decisions about task type, action mode, scope, validation need, ambiguity and whether safe filler compaction is appropriate. Jev does not rewrite the user's prompt. xLay preserves explicit user restrictions and only removes a small set of polite filler phrases when Jev says compaction is safe.

## Agent sessions

Claude Code is invoked in print/stream-json mode and the returned `session_id` is reused with `--resume` for later Claude turns. Codex is invoked with `codex exec --json`; its `thread_id` is reused with `codex exec --json resume <thread_id> ...` for later Codex turns.

Switching agents does not destroy the other agent's xLay session id, so `/codex` → `/claude` continues each agent's own conversation.

## Safety / permissions

xLay deliberately does not bypass Claude Code or Codex safety/permission settings. It inherits the configuration of the installed coding agent. Configure edit/sandbox/approval behavior in Claude Code or Codex itself according to your environment.
