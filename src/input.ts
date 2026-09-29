import readline from "node:readline/promises";
import { Writable, type Readable } from "node:stream";
import { c, inputRule } from "./ui.js";
import { approvalPreview, type ApprovalRequest } from "./approvals.js";
import { stripVTControlCharacters } from "node:util";

type Input = Readable & { isTTY?: boolean };
type Output = Writable & { isTTY?: boolean; columns?: number; rows?: number };
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function width(value: string): number {
  const cp = value.codePointAt(0) || 0;
  if (/^[\p{Mark}\p{Control}]+$/u.test(value)) return 0;
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F/u.test(value)) return 2;
  return cp >= 0x1100 && (cp <= 0x115f || cp === 0x2329 || cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe10 && cp <= 0xfe6f) ||
    (cp >= 0xff01 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3fffd)) ? 2 : 1;
}

// A horizontal viewport keeps the frame height constant for long prompts.
export function inputViewport(line: string, cursor: number, capacity: number): { text: string; cursor: number } {
  const cells = Array.from(segmenter.segment(line), part => ({
    start: part.index,
    text: /[\p{Control}]/u.test(part.segment) ? " " : part.segment,
    width: /[\p{Control}]/u.test(part.segment) ? 1 : width(part.segment),
  }));
  let end = cells.findIndex(cell => cell.start >= cursor);
  if (end < 0) end = cells.length;
  let start = end;
  let cursorWidth = 0;
  while (start > 0 && cursorWidth + cells[start - 1].width < capacity) {
    cursorWidth += cells[--start].width;
  }
  let used = 0;
  let text = "";
  for (let i = start; i < cells.length && used + cells[i].width <= capacity; i++) {
    text += cells[i].text;
    used += cells[i].width;
  }
  return { text, cursor: cursorWidth };
}

export class ShellInput {
  private readonly rl: readline.Interface;
  private readonly terminal: boolean;
  private closed = false;
  private abort?: AbortController;
  private approvalQueue: Promise<unknown> = Promise.resolve();
  private readonly cancellation = new AbortController();
  get signal(): AbortSignal { return this.cancellation.signal; }

  constructor(private readonly input: Input, private readonly output: Output) {
    this.terminal = Boolean(input.isTTY && output.isTTY);
    // Retain readline editing/history, but suppress its physical cursor writes.
    // Only our renderer controls the visible frame.
    const silent = new Writable({ write(_chunk, _encoding, done) { done(); } });
    this.rl = readline.createInterface({ input, output: this.terminal ? silent : output, terminal: this.terminal });
    this.rl.on("SIGINT", () => this.close());
    this.rl.on("close", () => { this.closed = true; this.abort?.abort(); this.cancellation.abort(); });
  }

  close(): void { this.rl.close(); }

  approve(request: ApprovalRequest, signal: AbortSignal): Promise<boolean> {
    const pending = this.approvalQueue.then(() => this.chooseApproval(request, signal));
    this.approvalQueue = pending.catch(() => false);
    return pending;
  }

  private async chooseApproval(request: ApprovalRequest, signal: AbortSignal): Promise<boolean> {
    if (this.closed || signal.aborted) return false;
    // Tool text stays inside a quoted preview and cannot emit terminal controls.
    const safe = (text: string) => stripVTControlCharacters(text).replace(/[\p{Control}\p{Format}]/gu, char => char === "\n" || char === "\t" ? char : "");
    const preview = safe(approvalPreview(request)).split("\n").map(line => `  │ ${line}`).join("\n");
    this.output.write(`\n${c.bold(`${request.agent === "claude" ? "Claude" : "Codex"} · Cần cấp quyền`)}\n${JSON.stringify(safe(request.title))}\n${preview}\n`);
    if (!this.terminal) {
      this.output.write("Không có terminal tương tác — đã từ chối yêu cầu cấp quyền.\n");
      return false;
    }
    let allow = false;
    this.output.write("1/y: cho phép lần này · 2/n/Esc: từ chối · ← → và Enter để chọn\n");
    const render = () => {
      const label = `${allow ? "❯" : " "} Cho phép  ${allow ? " " : "❯"} Từ chối`;
      const view = inputViewport(label, allow ? 0 : label.length, Math.max(4, (this.output.columns || 80) - 1));
      this.output.write(`\r\u001b[2K${view.text}`);
    };
    return await new Promise<boolean>(resolve => {
      let done = false;
      const finish = (accepted: boolean) => {
        if (done) return;
        done = true;
        this.input.off("keypress", keypress);
        this.output.off("resize", render);
        this.rl.off("close", cancel);
        signal.removeEventListener("abort", cancel);
        if (!this.closed) this.rl.write(null, { ctrl: true, name: "u" });
        this.output.write(`\r\u001b[2K${accepted ? "✓ Đã cho phép lần này — đang tiếp tục…" : "Đã từ chối."}\n`);
        resolve(accepted);
      };
      const cancel = () => finish(false);
      const keypress = (text: string, key: { name?: string; ctrl?: boolean }) => {
        if (key.ctrl && key.name === "c") return cancel();
        if (key.name === "escape" || text === "2" || text?.toLowerCase() === "n") return finish(false);
        if (text === "1" || text?.toLowerCase() === "y") return finish(true);
        if (["left", "right", "up", "down", "tab"].includes(key.name ?? "")) { allow = !allow; render(); }
        if (key.name === "return" || key.name === "enter") finish(allow);
      };
      this.input.on("keypress", keypress);
      this.output.on("resize", render);
      this.rl.once("close", cancel);
      signal.addEventListener("abort", cancel, { once: true });
      render();
    });
  }

  async read(): Promise<string | undefined> {
    if (this.closed) return undefined;
    this.abort = new AbortController();
    let editing = true;
    let drawn = false;
    let previousColumns = this.output.columns || 80;
    const render = () => {
      if (!editing || !this.terminal) return;
      const columns = Math.max(4, this.output.columns || 80);
      const view = inputViewport(this.rl.line, this.rl.cursor, columns - 4);
      const rule = c.dim(inputRule(columns));
      // Reserve physical rows BEFORE positioning the editing cursor. Do not
      // restore coordinates saved before a possible terminal scroll.
      if (!drawn) this.output.write("\r\n\n\u001b[2A");
      else {
        const topRows = Math.ceil((previousColumns - 1) / columns);
        this.output.write(`\r\u001b[${topRows}A`);
        if (columns !== previousColumns) this.output.write("\u001b[J");
      }
      this.output.write(`\u001b[2K${rule}\r\n\u001b[2K> ${view.text}\r\n\u001b[2K${rule}\r\u001b[1A\u001b[${view.cursor + 3}G`);
      drawn = true;
      previousColumns = columns;
    };
    const keypress = (_text: string, key: { name?: string }) => {
      if (key.name === "return" || key.name === "enter" || this.closed) return;
      render();
    };
    this.input.on("keypress", keypress);
    this.output.on("resize", render);
    try {
      if (!this.terminal) this.output.write(`${c.dim(inputRule(this.output.columns || 80))}\n`);
      const pending = this.rl.question(this.terminal ? "" : "> ", { signal: this.abort.signal });
      render();
      const answer = await pending;
      if (this.terminal) {
        // Commit the complete prompt to scrollback, not only its visible slice.
        const safeAnswer = answer.replace(/[\p{Control}]/gu, " ");
        const rule = c.dim(inputRule(this.output.columns || 80));
        this.output.write(`\r\u001b[1A\u001b[J${rule}\r\n> ${safeAnswer}\r\n${rule}\r\n`);
        drawn = false;
      }
      return answer;
    } catch (error: any) {
      if (error?.name === "AbortError" || error?.code === "ERR_USE_AFTER_CLOSE") return undefined;
      throw error;
    } finally {
      editing = false;
      this.input.off("keypress", keypress);
      this.output.off("resize", render);
      if (this.terminal && drawn) this.output.write("\r\u001b[1B\n");
      else if (!this.terminal) this.output.write(`\n${c.dim(inputRule(this.output.columns || 80))}\n`);
      this.abort = undefined;
    }
  }
}
