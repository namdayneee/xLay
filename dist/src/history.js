import fs from "node:fs";
import path from "node:path";
import { getPaths } from "./config.js";
export function appendHistory(entry) {
    try {
        const file = path.join(getPaths().home, "history.jsonl");
        fs.appendFileSync(file, `${JSON.stringify({
            at: new Date().toISOString(),
            agent: entry.agent,
            repo: entry.repo,
            taskType: entry.decision.taskType.value,
            taskConfidence: entry.decision.taskType.confidence,
            jevSource: entry.decision.source,
            jevUsage: entry.decision.usage,
            exitCode: entry.exitCode,
        })}\n`, "utf8");
    }
    catch {
        // History must never break a coding session.
    }
}
//# sourceMappingURL=history.js.map