import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runAgent } from "./agents/index.js";
import { compileAgentPrompt } from "./compiler.js";
import { loadConfig, resolveJevApiKey, resolveJevEndpoint } from "./config.js";
import { collectRepoContext } from "./context/repo.js";
import { appendHistory } from "./history.js";
import { analyzeWithJev } from "./jev/client.js";
import { commandExists } from "./process.js";
import { ShellState } from "./session/state.js";
import { readInput } from "./input.js";
import {
  c,
  printAgentSwitch,
  printAgentTitle,
  printError,
  printHeader,
  printJevSummary,
} from "./ui.js";

function normalizeCommand(value: string): string {
  const v = value.trim().toLowerCase();
  if (["/claude", "claude"].includes(v)) return "/claude";
  if (["/codex", "codex"].includes(v)) return "/codex";
  if (["/exit", "exit", "quit", "/quit"].includes(v)) return "/exit";
  if (["/help", "help"].includes(v)) return "/help";
  return "";
}

export async function runShell(cwd = process.cwd()): Promise<void> {
  const config = loadConfig();
  const apiKey = resolveJevApiKey();
  const endpoint = resolveJevEndpoint(config);
  const state = new ShellState(config.defaultAgent);
  const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
  let closing = false;
  rl.on("SIGINT", () => {
    closing = true;
    rl.close();
  });

  printHeader(cwd, state.agent, Boolean(apiKey));

  while (!closing) {
    let raw: string;
    try {
      raw = await readInput(rl, output);
    } catch (error: any) {
      if (error?.code === "ERR_USE_AFTER_CLOSE") break;
      throw error;
    }
    const message = raw.trim();
    if (!message) continue;

    const command = normalizeCommand(message);
    if (command === "/exit") break;
    if (command === "/help") {
      console.log(`\n${c.bold("Commands")}\n/claude  use Claude Code\n/codex   use Codex\n/help    show commands\n/exit    close xLay\n`);
      continue;
    }
    if (command === "/claude" || command === "/codex") {
      state.agent = command === "/claude" ? "claude" : "codex";
      printAgentSwitch(state.agent);
      continue;
    }

    if (!commandExists(state.agent)) {
      printError(`${state.agent} CLI was not found. Install/login to it first, or switch agent.`);
      continue;
    }

    const repo = collectRepoContext(cwd, message, config.context.maxCandidateFiles);
    const decision = await analyzeWithJev({
      apiKey,
      config,
      endpoint,
      input: message,
      agent: state.agent,
      repo,
    });
    printJevSummary(decision, repo.candidateFiles.length);

    const prompt = compileAgentPrompt(message, decision, repo);
    printAgentTitle(state.agent);

    try {
      const result = await runAgent(state.agent, prompt, repo.cwd, state.currentSessionId);
      state.currentSessionId = result.sessionId;
      appendHistory({ agent: state.agent, decision, repo: repo.repoName, exitCode: result.exitCode });
      if (result.exitCode !== 0) printError(`${state.agent} exited with code ${result.exitCode}.`);
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
    }
    console.log();
  }

  if (!closing) rl.close();
  console.log(c.dim("xLay closed."));
}
