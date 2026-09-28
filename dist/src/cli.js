#!/usr/bin/env node
import { runDoctor } from "./doctor.js";
import { runSetup } from "./setup.js";
import { runShell } from "./shell.js";
const arg = process.argv[2]?.toLowerCase();
if (!arg) {
    await runShell();
}
else if (arg === "setup") {
    await runSetup();
}
else if (arg === "doctor") {
    runDoctor();
}
else if (["--help", "-h", "help"].includes(arg)) {
    console.log(`
xLay

Usage:
  xlay          open the interactive chat
  xlay setup    configure Jev once
  xlay doctor   check Claude/Codex/Jev

Inside chat:
  /claude       use Claude Code (default)
  /codex        use Codex
  /help         show commands
  /exit         close xLay
`);
}
else {
    console.error(`Unknown command: ${arg}\nRun: xlay --help`);
    process.exitCode = 1;
}
//# sourceMappingURL=cli.js.map