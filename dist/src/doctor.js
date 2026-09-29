import { loadConfig, resolveJevApiKey, resolveJevEndpoint } from "./config.js";
import { commandExists } from "./process.js";
import { c } from "./ui.js";
export function runDoctor() {
    const config = loadConfig();
    const rows = [
        ["node >=20", Number(process.versions.node.split(".")[0]) >= 20],
        ["git", commandExists("git")],
        ["claude", commandExists("claude")],
        ["codex", commandExists("codex")],
        ["TypeSafe API key", Boolean(resolveJevApiKey())],
    ];
    console.log(`\n${c.bold("xLay doctor")}\n`);
    for (const [name, ok] of rows)
        console.log(`${ok ? c.green("✓") : c.yellow("○")} ${name}`);
    console.log(`\nJev endpoint: ${resolveJevEndpoint(config)}`);
    console.log(`Default agent: ${config.defaultAgent}\n`);
}
//# sourceMappingURL=doctor.js.map