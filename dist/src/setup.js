import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DEFAULT_CONFIG, getPaths, loadConfig, loadCredentials, saveConfig, saveCredentials } from "./config.js";
import { commandExists } from "./process.js";
import { c } from "./ui.js";
export async function runSetup() {
    const rl = readline.createInterface({ input, output });
    const config = loadConfig();
    const credentials = loadCredentials();
    console.log(`\n${c.bold("xLay setup")}\n`);
    console.log(`Claude Code: ${commandExists("claude") ? c.green("found") : c.yellow("not found")}`);
    console.log(`Codex:       ${commandExists("codex") ? c.green("found") : c.yellow("not found")}`);
    console.log();
    const key = await rl.question(credentials.jevApiKey || process.env.JEV_API_KEY
        ? "Jev API key already exists. Press Enter to keep it, or paste a replacement: "
        : "Paste your Jev API key (Enter = local fallback for now): ");
    if (key.trim())
        credentials.jevApiKey = key.trim();
    config.defaultAgent = "claude";
    config.jev = { ...DEFAULT_CONFIG.jev, ...config.jev, enabled: true };
    saveConfig(config);
    saveCredentials(credentials);
    rl.close();
    const paths = getPaths();
    console.log(`\n${c.green("Setup complete.")}`);
    console.log(`Default agent: ${c.cyan("Claude")}`);
    console.log(`Config: ${paths.config}`);
    console.log(`Credentials: ${paths.credentials}`);
    if (!credentials.jevApiKey && !process.env.JEV_API_KEY) {
        console.log(c.yellow("No Jev key yet; xLay will use the local fallback until you add one."));
    }
    console.log();
}
//# sourceMappingURL=setup.js.map