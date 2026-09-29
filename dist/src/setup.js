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
    const key = await rl.question(credentials.typesafeApiKey || process.env.TYPESAFE_API_KEY
        ? "TypeSafe API key already exists. Press Enter to keep it, or paste a replacement: "
        : "Paste your TypeSafe API key from console.typesafe.ai (Enter = local fallback): ");
    if (key.trim())
        credentials.typesafeApiKey = key.trim();
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
    if (!credentials.typesafeApiKey && !process.env.TYPESAFE_API_KEY) {
        console.log(c.yellow("No TypeSafe key yet; xLay will use local fallback. Legacy Jev service keys are not reused."));
    }
    console.log();
}
//# sourceMappingURL=setup.js.map