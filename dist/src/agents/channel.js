import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { findExecutable } from "../process.js";
// Keep stdin open throughout the turn: permission responses share this channel.
export const runChannel = async (options) => {
    if (options.signal?.aborted)
        return 130;
    const executable = findExecutable(options.command) ?? options.command;
    const child = spawn(executable, options.args, {
        cwd: options.cwd, env: process.env, windowsHide: true,
        shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(executable),
        stdio: ["pipe", "pipe", "pipe"],
    });
    const controller = new AbortController();
    const stdout = createInterface({ input: child.stdout });
    const stderr = createInterface({ input: child.stderr });
    let failure;
    let finished = false;
    let timer;
    const channel = {
        signal: controller.signal,
        send(message) {
            if (!controller.signal.aborted && !child.stdin.destroyed)
                child.stdin.write(`${JSON.stringify(message)}\n`);
        },
        finish() {
            if (finished)
                return;
            finished = true;
            controller.abort();
            child.stdin.end();
            timer = setTimeout(() => child.kill(), 1500);
        },
        fail(error) { failure = error; channel.finish(); child.kill(); },
    };
    stdout.on("line", line => {
        if (!line.trim() || controller.signal.aborted)
            return;
        let message;
        try {
            message = JSON.parse(line);
        }
        catch {
            channel.fail(new Error("Agent returned invalid protocol data; stopped without approving pending tools."));
            return;
        }
        Promise.resolve().then(() => options.receive(message, channel)).catch(error => channel.fail(error instanceof Error ? error : new Error(String(error))));
    });
    stderr.on("line", line => options.stderr?.(line));
    child.stdin.on("error", error => { if (!finished)
        channel.fail(error); });
    const interrupted = () => channel.fail(new Error("Agent run interrupted."));
    process.once("SIGINT", interrupted);
    options.signal?.addEventListener("abort", interrupted, { once: true });
    try {
        return await new Promise((resolve, reject) => {
            child.once("error", reject);
            child.once("close", code => failure ? reject(failure) : resolve(code ?? (finished ? 0 : 1)));
            child.once("spawn", () => {
                try {
                    options.start(channel);
                }
                catch (error) {
                    channel.fail(error);
                }
            });
        });
    }
    finally {
        controller.abort();
        if (timer)
            clearTimeout(timer);
        stdout.close();
        stderr.close();
        process.off("SIGINT", interrupted);
        options.signal?.removeEventListener("abort", interrupted);
    }
};
//# sourceMappingURL=channel.js.map