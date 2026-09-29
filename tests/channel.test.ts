import assert from "node:assert/strict";
import test from "node:test";
import { runChannel } from "../src/agents/channel.js";
import { runClaude } from "../src/agents/claude.js";

test("real child pipe remains open for approval and closes after result", { timeout: 10000 }, async () => {
  const script = `
    const readline = require('node:readline');
    const rl = readline.createInterface({ input: process.stdin });
    const send = value => console.log(JSON.stringify(value));
    rl.on('line', line => {
      const event = JSON.parse(line);
      if (event.type === 'control_request') send({type:'control_response',response:{subtype:'success',request_id:event.request_id}});
      if (event.type === 'user') send({type:'control_request',request_id:'write',request:{subtype:'can_use_tool',tool_name:'Write',input:{file_path:'README.md',content:'preview'}}});
      if (event.type === 'control_response') {
        if (event.response.response.behavior !== 'allow') process.exitCode = 3;
        send({type:'result', session_id:'retained-session', usage:{input_tokens:1,output_tokens:1}});
      }
    });
  `;
  let prompted = false;
  const result = await runClaude("fix", process.cwd(), undefined, async request => {
    prompted = true;
    assert.match(JSON.stringify(request.details), /README.md/);
    await new Promise(resolve => setTimeout(resolve, 20));
    return true;
  }, options => runChannel({ ...options, command: process.execPath, args: ["-e", script] }));
  assert.equal(prompted, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.sessionId, "retained-session");
});

test("child closing while approval is pending cancels the prompt", { timeout: 10000 }, async () => {
  let cancelled = false;
  const script = `console.log(JSON.stringify({type:'control_request',request_id:'write',request:{subtype:'can_use_tool',tool_name:'Write',input:{}}})); setTimeout(()=>process.exit(1),100);`;
  const result = await runClaude("fix", process.cwd(), undefined, async (_request, signal) => {
    await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
    cancelled = true;
    return false;
  }, options => runChannel({ ...options, command: process.execPath, args: ["-e", script] }));
  assert.equal(result.exitCode, 1);
  assert.equal(cancelled, true);
});

test("shell cancellation interrupts the active child", { timeout: 10000 }, async () => {
  const abort = new AbortController();
  await assert.rejects(runChannel({
    command: process.execPath, args: ["-e", "console.log('{}'); setInterval(()=>{},1000)"], cwd: process.cwd(), signal: abort.signal,
    start() {}, receive() { abort.abort(); },
  }), /interrupted/);
});
