import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { findExecutable } from "../process.js";

export interface Channel {
  send(message: unknown): void;
  finish(): void;
  fail(error: Error): void;
  signal: AbortSignal;
}

export interface ChannelOptions {
  signal?: AbortSignal;
  command: string;
  args: string[];
  cwd: string;
  start(channel: Channel): void;
  receive(message: any, channel: Channel): void | Promise<void>;
  stderr?(line: string): void;
}

export type RunChannel = (options: ChannelOptions) => Promise<number>;

// Keep stdin open throughout the turn: permission responses share this channel.
export const runChannel: RunChannel = async options => {
  if (options.signal?.aborted) return 130;
  const executable = findExecutable(options.command) ?? options.command;
  const child = spawn(executable, options.args, {
    cwd: options.cwd, env: process.env, windowsHide: true,
    shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(executable),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const controller = new AbortController();
  const stdout = createInterface({ input: child.stdout });
  const stderr = createInterface({ input: child.stderr });
  let failure: Error | undefined;
  let finished = false;
  let timer: NodeJS.Timeout | undefined;
  const channel: Channel = {
    signal: controller.signal,
    send(message) {
      if (!controller.signal.aborted && !child.stdin.destroyed) child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    finish() {
      if (finished) return;
      finished = true;
      controller.abort();
      child.stdin.end();
      timer = setTimeout(() => child.kill(), 1500);
    },
    fail(error) { failure = error; channel.finish(); child.kill(); },
  };
  stdout.on("line", line => {
    if (!line.trim() || controller.signal.aborted) return;
    let message: unknown;
    try { message = JSON.parse(line); }
    catch { channel.fail(new Error("Agent returned invalid protocol data; stopped without approving pending tools.")); return; }
    Promise.resolve().then(() => options.receive(message, channel)).catch(error => channel.fail(error instanceof Error ? error : new Error(String(error))));
  });
  stderr.on("line", line => options.stderr?.(line));
  child.stdin.on("error", error => { if (!finished) channel.fail(error); });
  const interrupted = () => channel.fail(new Error("Agent run interrupted."));
  process.once("SIGINT", interrupted);
  options.signal?.addEventListener("abort", interrupted, { once: true });
  try {
    return await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", code => failure ? reject(failure) : resolve(code ?? (finished ? 0 : 1)));
      child.once("spawn", () => {
        try { options.start(channel); } catch (error) { channel.fail(error as Error); }
      });
    });
  } finally {
    controller.abort();
    if (timer) clearTimeout(timer);
    stdout.close(); stderr.close();
    process.off("SIGINT", interrupted);
    options.signal?.removeEventListener("abort", interrupted);
  }
};
