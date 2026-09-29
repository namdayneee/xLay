# xLay

xLay is an interactive terminal layer in front of Claude Code and Codex. You open it once with `xlay`, type naturally, and Jev drives xLay's turn policy: whether to dispatch or ask for clarification, how many context hints to select, whether safe compaction is allowed, and what validation to request.

## Daily UX

```text
          ██╗
██╗  ██╗  ██║       █████╗  ██╗   ██╗
 ╚███╔╝   ██║      ██╔══██╗ ╚██╗ ██╔╝
 ██╔██╗   ██║      ███████║  ╚████╔╝
██╔╝ ██╗  ███████╗ ██║  ██║   ╚██╔╝
╚═╝  ╚═╝  ╚══════╝ ╚═╝  ╚═╝    ██║
                               ╚═╝

Matavi · Claude · Jev ✓
/claude  /codex  /help  /exit

────────────────────────────────────────────────────
> sửa login, giữ nguyên UI và đừng đổi database
────────────────────────────────────────────────────
Jev: run · act · scope minimal · context 2/2 · validation relevant

Claude
...
```

Claude is the default. Type `/codex` (or simply `codex`) to switch to Codex. Type `/claude` to switch back. xLay keeps a separate resumable session id for each agent during the shell session.

The input frame shows both borders while editing. Long prompts scroll horizontally; Enter submits and displays the complete prompt in scrollback. Arrow keys and readline history remain available. Resizing redraws the frame to fit the terminal.

The terminal logo fades from blue through purple to pink, with a compact `xLay` wordmark in narrow terminals. Responses from both agents render Markdown headings, emphasis, lists, links, quotes and code in the terminal instead of displaying formatting markers. Literal code retains its original characters and indentation. This is xLay's response renderer; the agents' interactive interfaces are not included in their JSON output.

## Requirements

- Node.js 20+
- Git
- Claude Code CLI for Claude usage
- Codex CLI for Codex usage
- TypeSafe API key for Jev decisions (optional at first; local fallback exists)

## Install locally

```bash
cd xLay
npm link --ignore-scripts --omit=dev
xlay setup
xlay doctor
xlay
```

The repository includes the built JavaScript CLI, so this install needs no build step or development dependencies. After setup, enter any Git repository and run:

```bash
xlay
```

For development, run `npm install --include=dev` and `npm run check`. Commit the updated `dist/src/*.js` files (including subdirectories) whenever source changes so the quick install stays current.

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

xLay calls TypeSafe directly at `https://api.typesafe.ai/v1/systemone`, pinning `jev-1.13.0`. Get a key from [TypeSafe Console](https://console.typesafe.ai), then run `xlay setup` or supply `TYPESAFE_API_KEY`. Existing config is normalized to the direct endpoint and the old `jev-1.13` model id is migrated in memory; setup persists the migration. Old `JEV_API_KEY`, `JEV_API_URL` and saved `jevApiKey` credentials are not reused or forwarded. No proxy or SDK dependency is required. See the [official API contract](https://docs.typesafe.ai/api).

Jev returns typed decision signals; `src/policy.ts` resolves them into a local `TurnPolicy`. `src/turn.ts` applies that policy before compiling any agent prompt. Task classification is retained for history, not injected as prompt metadata.

- Dispatch pauses when action confidence is below 0.7, or ambiguity is at least 2.5 on the 0–3 scale with confidence at least 0.7. No agent is called on this branch. The next message adds clarification to the preserved request, independently for each selected agent.
- xLay builds a bounded local shortlist, then asks Jev one relevance question per candidate in the same request as the policy questions. Each question contains that file's path and excerpt. This lets Jev match natural-language intent to code beyond literal keyword overlap. A few Vietnamese concept aliases improve local retrieval (for example, `đăng nhập` → auth/login/session).
- Minimal scope allows 2 hints, focused scope 6, and broad scope the configured `context.maxCandidateFiles` limit (default 6, bounded to 50), always capped by the available shortlist. Explanation turns can also receive relevant code. Jev scores below 1.5 with confidence at least 0.7 are excluded; uncertain/missing scores keep local candidates. Explicit eligible paths take priority. These thresholds are initial policy settings, not a measured accuracy guarantee.
- Explicit local read-only intent and minimal scope override conflicting model signals. Low-confidence scope uses the local fallback. Local recognition is heuristic; the full user request remains authoritative.
- Implementation turns request relevant validation; inspection and explanation request it when Jev indicates a need. Explicit user restrictions on tests or commands always take precedence. xLay does not execute or certify the agent's validation itself.
- Compaction requires an API decision of at least 0.9 and removes only recognized leading polite filler. Multiline input, code and quoted literals are preserved. Fallback never compacts.

Missing credentials, disabled Jev, timeout, network errors and malformed or incomplete answers all use the same local policy pipeline. The fallback recognizes common Vietnamese/English intents and asks for clarification on a few targetless requests such as `fix it` in a fresh session. Existing agent sessions can resolve short follow-ups from their own history.

Transient HTTP failures get one retry, respecting Retry-After within the overall timeout. The terminal and history identify fallback reasons, so a failed API request is not mistaken for a Jev decision.

The terminal displays the effective policy and history stores it alongside the decision source. Jev never generates clarification text, rewrites requests, chooses shell commands, switches agents, resets sessions or changes permission settings. Clarification text is a local template.

## Context and token reduction

The optimization targets unnecessary agent exploration and repeated context, not aggressive rewriting of the user's language:

- At most 16 tracked text candidates, each with an excerpt of at most 512 UTF-8 bytes. Files over 128 KB, external paths, file symlinks, generated directories and common credential filenames are excluded. Only supported text extensions are considered. Excerpts are sent to TypeSafe; filename exclusions are not a general secret scanner.
- At most 2,400 excerpt characters enter the agent prompt per turn. The whole TypeSafe request is capped at 28,000 bytes; oversized requests fall back without truncating the user's request.
- Successfully delivered, unchanged excerpts are omitted on later turns in the same agent session. Changed file fingerprints refresh the context. Claude and Codex do not share this memory.
- Short policy instructions replace the previous verbose wrapper. Paths and partial excerpts remain evidence to verify; the agent may search further when they are insufficient. This does not cap the agent's own tool output or retained conversation history.

After each turn, xLay displays provider-reported input/output/cache tokens, plus context character counts. `~/.xlay/history.jsonl` records raw agent usage, normalized token counts, Jev usage/model/fallback reason, duration, effective policy and context metrics. It does not record prompts or source excerpts. Missing token usage stays unknown. Character reduction is never presented as token savings.

### Measure against a baseline

Use separate fresh xLay sessions with the same agent model/settings, repository path/state and exact request. Prefer read-only tasks for the first comparison. For edit tasks, restore the same starting state yourself between runs and verify equivalent outcomes. Do not compare an already-solved task against a fresh one.

1. Set `XLAY_BENCHMARK_BASELINE=1` in your terminal and run `xlay`. This development-only mode forwards the original request without Jev or context optimization. It does not change agent permissions.
2. Unset `XLAY_BENCHMARK_BASELINE`, start a fresh `xlay`, and repeat the request with TypeSafe configured.
3. Save the matching history rows as `baseline.jsonl` and `optimized.jsonl`, then run `npm run compare -- baseline.jsonl optimized.jsonl`. You can also pass the same combined history file twice; the comparator filters modes.

The comparator pairs identical request hashes and agents, reports agent-only and combined Jev+agent token changes, and rejects duplicate, failed or missing-usage pairs. Exit code zero is not a quality assessment: inspect task results and constraints before accepting a saving. Token counts are not billing costs; cached tokens and providers have different pricing. No percentage reduction is promised until representative live runs demonstrate it.

Tests cover the API contract with mocked responses, Vietnamese retrieval, semantic selection, cache invalidation, fallback, budgets and benchmark arithmetic. They do not measure the live model's judgment quality or real agent savings.

## Agent sessions

Claude Code is invoked in print/stream-json mode and the returned `session_id` is reused with `--resume` for later Claude turns. Codex is invoked with `codex exec --json`; its `thread_id` is reused with `codex exec --json resume <thread_id> ...` for later Codex turns.

Switching agents does not destroy the other agent's xLay session id, so `/codex` → `/claude` continues each agent's own conversation.

## Safety / permissions

xLay deliberately does not bypass Claude Code or Codex safety/permission settings. It inherits the configuration of the installed coding agent. Dispatch, context budgets and compaction are enforced by xLay. Read-only mode, scope and validation are instructions to the agent, not an OS sandbox or a guarantee that an agent cannot write. Configure edit/sandbox/approval behavior in Claude Code or Codex itself according to your environment.
