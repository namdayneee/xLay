import assert from "node:assert/strict";
import readline from "node:readline/promises";
import { PassThrough } from "node:stream";
import test from "node:test";
import { readInput } from "../src/input.js";

test("typing, wrapping and resizing never redraw the border or save the cursor", async () => {
  const input = new PassThrough();
  const output = Object.assign(new PassThrough(), { columns: 24 });
  let transcript = "";
  output.on("data", chunk => { transcript += chunk.toString(); });
  const rl = readline.createInterface({ input, output, terminal: true });
  try {
    for (let turn = 0; turn < 3; turn++) {
      transcript = "";
      const answer = readInput(rl, output);
      const text = "/".repeat(100) + " sửa giao diện";
      for (const char of text) input.write(char);
      input.write("\u001b[D");
      input.write("\u001b[C");
      output.columns = 18 + turn;
      output.emit("resize");
      assert.equal((transcript.match(/─+/g) || []).length, 1);
      assert.doesNotMatch(transcript, /\u001b[78]/);
      input.write("\r");
      assert.equal(await answer, text);
      assert.equal((transcript.match(/─+/g) || []).length, 2);
      assert.ok(transcript.includes("─".repeat(output.columns - 1)));
    }
  } finally {
    rl.close();
  }
});

test("piped input places the closing border on its own line", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let transcript = "";
  output.on("data", chunk => { transcript += chunk.toString(); });
  const rl = readline.createInterface({ input, output, terminal: false });
  try {
    const answer = readInput(rl, output);
    input.write("/exit\n");
    assert.equal(await answer, "/exit");
    assert.equal(transcript.split("\n").length, 4);
    assert.equal((transcript.match(/─+/g) || []).length, 2);
  } finally {
    rl.close();
  }
});
