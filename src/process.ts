import { spawn, spawnSync } from "node:child_process";

export function findExecutable(name: string): string | undefined {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(locator, [name], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) return undefined;
  const first = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return first || undefined;
}

export function commandExists(name: string): boolean {
  return Boolean(findExecutable(name));
}

export interface SpawnLinesOptions {
  cwd: string;
  args: string[];
  command: string;
  onStdoutLine: (line: string) => void;
  onStderrLine?: (line: string) => void;
  stdinData?: string;
}

export async function spawnLines(options: SpawnLinesOptions): Promise<number> {
  const executable = findExecutable(options.command) ?? options.command;
  const child = spawn(executable, options.args, {
    cwd: options.cwd,
    env: process.env,
    windowsHide: true,
    shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(executable),
    stdio: [options.stdinData !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
  });

  let stdoutBuffer = "";
  let stderrBuffer = "";

  // Both output streams are explicitly piped above.
  const stdout = child.stdout!;
  const stderr = child.stderr!;
  stdout.setEncoding("utf8");
  stderr.setEncoding("utf8");

  if (options.stdinData !== undefined && child.stdin) {
    child.stdin.end(options.stdinData);
  }

  stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
    const parts = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = parts.pop() ?? "";
    for (const line of parts) options.onStdoutLine(line);
  });

  stderr.on("data", (chunk: string) => {
    stderrBuffer += chunk;
    const parts = stderrBuffer.split(/\r?\n/);
    stderrBuffer = parts.pop() ?? "";
    for (const line of parts) options.onStderrLine?.(line);
  });

  return await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (stdoutBuffer.trim()) options.onStdoutLine(stdoutBuffer);
      if (stderrBuffer.trim()) options.onStderrLine?.(stderrBuffer);
      resolve(code ?? 1);
    });
  });
}
