import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import xterm from "@xterm/headless";
import { ShellInput, inputViewport } from "../src/input.js";

function fixture(columns = 30, rows = 8) {
  const terminal = new xterm.Terminal({ cols: columns, rows, allowProposedApi: true, scrollback: 1000 });
  const input = Object.assign(new PassThrough(), { isTTY: true });
  const output = Object.assign(new PassThrough(), { isTTY: true, columns, rows });
  output.on("data", chunk => terminal.write(chunk.toString()));
  const reader = new ShellInput(input, output);
  const flush = () => new Promise<void>(resolve => terminal.write("", resolve));
  const lines = () => {
    const buffer = terminal.buffer.active;
    return Array.from({ length: buffer.length }, (_, i) => buffer.getLine(i)!.translateToString(true));
  };
  const frame = () => {
    const buffer = terminal.buffer.active;
    const row = buffer.baseY + buffer.cursorY;
    assert.equal(buffer.getLine(row - 1)?.translateToString(true), "─".repeat(output.columns - 1));
    assert.match(buffer.getLine(row)!.translateToString(true), /^> /);
    assert.equal(buffer.getLine(row + 1)?.translateToString(true), "─".repeat(output.columns - 1));
    assert.ok(buffer.cursorX >= 2 && buffer.cursorX < output.columns - 1);
  };
  return { terminal, input, output, reader, flush, lines, frame };
}

test("frame stays intact at screen bottom while typing and editing long input", async () => {
  const f = fixture();
  try {
    f.output.write("previous response\r\n".repeat(20));
    const answer = f.reader.read();
    await f.flush();
    f.frame();
    const baseline = f.lines().length;
    const text = "/".repeat(100) + " sửa giao diện";
    for (const char of text) {
      f.input.write(char);
      await f.flush();
      f.frame();
      assert.equal(f.lines().length, baseline, "typing must not scroll");
    }
    for (const key of ["\u001b[D", "\u001b[C", "\u0001", "\u0005"]) {
      f.input.write(key);
      await f.flush();
      f.frame();
    }
    f.input.write("\r");
    assert.equal(await answer, text);
    await f.flush();
    assert.equal(f.lines().filter(line => /^─+$/.test(line)).length, 2);
    assert.ok(f.lines().join("").includes(text), "submitted prompt must remain complete in scrollback");
  } finally { f.reader.close(); f.terminal.dispose(); }
});

test("resize redraws a complete frame and preserves the answer", async () => {
  const f = fixture(60, 12);
  try {
    f.output.write("history\r\n".repeat(20));
    const answer = f.reader.read();
    f.input.write("sửa giao diện " + "/".repeat(90));
    await f.flush();
    for (const [columns, rows] of [[24, 8], [80, 15], [18, 6], [60, 12]]) {
      f.terminal.resize(columns, rows);
      f.output.columns = columns;
      f.output.rows = rows;
      f.output.emit("resize");
      await f.flush();
      f.frame();
      assert.equal(f.lines().filter(line => /^─+$/.test(line)).length, 2, JSON.stringify({ columns, rows, lines: f.lines(), cursor: f.terminal.buffer.active.cursorY }));
      assert.equal(f.lines().filter(line => line === "history").length, 20);
    }
    f.input.write("\r");
    assert.equal(await answer, "sửa giao diện " + "/".repeat(90));
  } finally { f.reader.close(); f.terminal.dispose(); }
});

test("Unicode, history and cancellation work without leaking listeners", async () => {
  const f = fixture();
  try {
    const text = "sửa e\u0301 中文 👩‍💻";
    let answer = f.reader.read();
    f.input.write(text);
    await f.flush();
    f.frame();
    f.input.write("\r");
    assert.equal(await answer, text);
    answer = f.reader.read();
    f.input.write("\u001b[A");
    await f.flush();
    f.frame();
    f.input.write("\r");
    assert.equal(await answer, text);
    answer = f.reader.read();
    f.input.write("\u0003");
    assert.equal(await answer, undefined);
    assert.equal(f.output.listenerCount("resize"), 0);
  } finally { f.reader.close(); f.terminal.dispose(); }
});

test("viewport retains grapheme clusters", () => {
  assert.equal(inputViewport("e\u0301👩‍💻", 7, 10).text, "e\u0301👩‍💻");
  assert.equal(inputViewport("e\u0301👩‍💻", 7, 10).cursor, 3);
});

test("piped input and EOF finish without terminal cursor escapes", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let transcript = "";
  output.on("data", chunk => { transcript += chunk.toString(); });
  const reader = new ShellInput(input, output);
  try {
    const answer = reader.read();
    input.write("/exit\n");
    assert.equal(await answer, "/exit");
    const eof = reader.read();
    input.end();
    assert.equal(await eof, undefined);
    assert.doesNotMatch(transcript, /\u001b\[\d*[ABGK]/);
  } finally { reader.close(); }
});

test("approval is one key, defaults to deny, and does not leak into the next prompt", async () => {
  const f = fixture(80, 16);
  try {
    const request = { agent: "claude" as const, title: "Write README.md", details: { file: "README.md", content: "hello" } };
    for (const [key, expected] of [["y", true], ["\r", false], ["\u001b[D\r", true], ["n", false]] as const) {
      const answer = f.reader.approve(request, new AbortController().signal);
      await f.flush();
      f.input.write(key);
      assert.equal(await answer, expected);
    }
    const next = f.reader.read();
    f.input.write("next task\r");
    assert.equal(await next, "next task");
    assert.equal(f.output.listenerCount("resize"), 0);
  } finally { f.reader.close(); f.terminal.dispose(); }
});

test("approval abort, EOF and noninteractive input fail closed", async () => {
  const f = fixture();
  const request = { agent: "codex" as const, title: "write", details: {} };
  try {
    const controller = new AbortController();
    const answer = f.reader.approve(request, controller.signal);
    await f.flush();
    controller.abort();
    assert.equal(await answer, false);
    assert.equal(f.output.listenerCount("resize"), 0);
    const closed = f.reader.approve(request, new AbortController().signal);
    await f.flush();
    f.reader.close();
    assert.equal(await closed, false);
  } finally { f.reader.close(); f.terminal.dispose(); }
  const reader = new ShellInput(new PassThrough(), new PassThrough());
  try { assert.equal(await reader.approve(request, new AbortController().signal), false); }
  finally { reader.close(); }
});
