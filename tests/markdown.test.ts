import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { renderMarkdown } from "../src/markdown.js";
import { renderLogo } from "../src/ui.js";

test("agent prose renders headings, emphasis, lists and links without raw markers", () => {
  const source = "## Kết quả\n**Đã sửa** và ***đã kiểm tra***\n- Chạy `npm test`\n[README](https://example.com)";
  const expected = "Kết quả\nĐã sửa và đã kiểm tra\n• Chạy npm test\nREADME (https://example.com)";
  assert.equal(renderMarkdown(source, false), expected);
  assert.equal(stripVTControlCharacters(renderMarkdown(source, true)), expected);
  assert.match(renderMarkdown("**bold**", true), /\u001b\[1m/);
});

test("preserves literal asterisks, identifiers, inline and fenced code", () => {
  const source = "Use src/foo_bar_baz.ts and 2 * 3. `a ** b` \\*literal\\*\n```js\n  const x = a ** b;\n// **keep**\n```\n    **literal code**";
  assert.equal(renderMarkdown(source, false), "Use src/foo_bar_baz.ts and 2 * 3. a ** b *literal*\n  const x = a ** b;\n// **keep**\n    **literal code**");
});

test("long and unclosed code fences preserve code content", () => {
  assert.equal(renderMarkdown("````md\n```\n**raw**\n````", false), "```\n**raw**");
  assert.equal(renderMarkdown("~~~js\na ** b\n", false), "a ** b\n");
});

test("logo uses truecolor gradient and fits narrow terminals", () => {
  const plain = renderLogo(80, false);
  assert.equal(stripVTControlCharacters(renderLogo(80, true)), plain);
  assert.match(renderLogo(80, true), /38;2;77;165;232/);
  assert.equal(renderLogo(30, false), "xLay");
  assert.ok(plain.split("\n").every(line => line.length < 40));
});
