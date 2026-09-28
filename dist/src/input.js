import { c, inputPrompt, inputRule } from "./ui.js";
export async function readInput(rl, output) {
    output.write(`${c.dim(inputRule(output.columns || 80))}\n`);
    // Readline exclusively owns the cursor while editing. Drawing below its cursor
    // can scroll the terminal and invalidate both saved coordinates and wrapped input.
    const answer = await rl.question(inputPrompt());
    if (!rl.terminal)
        output.write("\n");
    output.write(`${c.dim(inputRule(output.columns || 80))}\n`);
    return answer;
}
//# sourceMappingURL=input.js.map