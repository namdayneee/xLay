import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { XLayConfig, XLayCredentials } from "./types.js";

const HOME = path.join(os.homedir(), ".xlay");
const CONFIG_PATH = path.join(HOME, "config.json");
const CREDENTIALS_PATH = path.join(HOME, "credentials.json");

export const DEFAULT_CONFIG: XLayConfig = {
  version: 1,
  defaultAgent: "claude",
  jev: {
    enabled: true,
    endpoint: "https://jev-api.org/api/v1/decisions",
    model: "jev-1.13",
    timeoutMs: 15000,
  },
  context: {
    maxCandidateFiles: 6,
  },
};

function ensureHome(): void {
  fs.mkdirSync(HOME, { recursive: true });
}

export function getPaths(): { home: string; config: string; credentials: string } {
  return { home: HOME, config: CONFIG_PATH, credentials: CREDENTIALS_PATH };
}

export function loadConfig(): XLayConfig {
  ensureHome();
  if (!fs.existsSync(CONFIG_PATH)) return structuredClone(DEFAULT_CONFIG);
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Partial<XLayConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      jev: { ...DEFAULT_CONFIG.jev, ...(parsed.jev ?? {}) },
      context: { ...DEFAULT_CONFIG.context, ...(parsed.context ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(config: XLayConfig): void {
  ensureHome();
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function loadCredentials(): XLayCredentials {
  ensureHome();
  if (!fs.existsSync(CREDENTIALS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8")) as XLayCredentials;
  } catch {
    return {};
  }
}

export function saveCredentials(credentials: XLayCredentials): void {
  ensureHome();
  fs.writeFileSync(CREDENTIALS_PATH, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function resolveJevApiKey(): string | undefined {
  return process.env.JEV_API_KEY?.trim() || loadCredentials().jevApiKey?.trim() || undefined;
}

export function resolveJevEndpoint(config: XLayConfig): string {
  return process.env.JEV_API_URL?.trim() || config.jev.endpoint;
}
