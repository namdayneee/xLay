# xLay

xLay is an interactive terminal layer in front of Claude Code and Codex. You open it once with `xlay`, type naturally, and Jev drives xLay's turn policy: whether to dispatch or ask for clarification, how many context hints to select, whether safe compaction is allowed, and what validation to request.

Claude is the default. Type `/codex` to switch to Codex and `/claude` to switch back. xLay keeps a separate resumable session id for each agent during the shell session.

## Requirements

- Node.js 20+
- Git
- Claude Code CLI for Claude usage
- Codex CLI for Codex usage
- TypeSafe API key for Jev decisions (optional; local fallback exists)

## Install

```bash
cd xLay
npm link --ignore-scripts --omit=dev
xlay setup
xlay doctor
xlay
```

The repository includes the built JavaScript CLI, so this install needs no build step. For development, run npm install --include=dev and npm run check.

Commands

Outside chat:

xlay          interactive shell
xlay setup    one-time Jev setup
xlay doctor   environment check

Inside chat:

/claude       switch to Claude Code (default)
/codex        switch to Codex
/help         show commands
/exit         close xLay

Safety

xLay does not bypass Claude Code or Codex safety/permission settings. It inherits the configuration of the installed coding agent; configure edit/sandbox/approval behavior in Claude Code or Codex itself.
