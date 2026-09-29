import fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { TokenUsage } from "./metrics.js";

interface RecordRow {
  taskId?: string; agent?: string; mode?: string; exitCode?: number;
  tokens?: TokenUsage; jevUsage?: { inputTokens?: number; outputTokens?: number };
  jevSource?: string;
  jevAttempted?: boolean;
}

export function compareRuns(baseline: RecordRow[], optimized: RecordRow[]) {
  const pairs: Array<{ taskId: string; baseline: number; optimized: number; jev: number; agentReductionPercent: number }> = [];
  const validTokens = (row: RecordRow) => row.tokens && [row.tokens.input, row.tokens.output, row.tokens.cached, row.tokens.total]
    .every(n => typeof n === "number" && Number.isFinite(n) && n >= 0);
  for (const row of baseline) {
    if (!row.taskId || row.mode !== "baseline" || row.exitCode !== 0 || !validTokens(row)) continue;
    const matches = optimized.filter(other => other.taskId === row.taskId && other.agent === row.agent && other.mode === "optimized");
    if (baseline.filter(other => other.taskId === row.taskId && other.agent === row.agent && other.mode === "baseline").length !== 1 || matches.length !== 1) continue;
    const other = matches[0];
    if (other.exitCode !== 0 || !validTokens(other) || row.tokens!.total === 0) continue;
    const input = other.jevUsage?.inputTokens;
    const output = other.jevUsage?.outputTokens;
    const usedJev = other.jevSource === "api" || other.jevAttempted;
    if (usedJev && ![input, output].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)) continue;
    const jev = usedJev ? input! + output! : 0;
    pairs.push({ taskId: row.taskId, baseline: row.tokens!.total, optimized: other.tokens!.total, jev,
      agentReductionPercent: 100 * (1 - other.tokens!.total / row.tokens!.total) });
  }
  const baselineTokens = pairs.reduce((sum, pair) => sum + pair.baseline, 0);
  const optimizedTokens = pairs.reduce((sum, pair) => sum + pair.optimized, 0);
  const jevTokens = pairs.reduce((sum, pair) => sum + pair.jev, 0);
  return { pairs, baselineTokens, optimizedTokens, jevTokens,
    agentReductionPercent: baselineTokens ? 100 * (1 - optimizedTokens / baselineTokens) : null,
    combinedReductionPercent: baselineTokens ? 100 * (1 - (optimizedTokens + jevTokens) / baselineTokens) : null,
    note: "Observed token counts, not cost or proof of equal quality. Review task outcomes. Use identical models, repo states and fresh sessions. Duplicate, failed and missing-usage pairs are excluded." };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const files = process.argv.slice(2);
  if (files.length !== 2) {
    console.error("Usage: npm run compare -- baseline.jsonl optimized.jsonl");
    process.exitCode = 1;
  } else {
    try {
      const read = (file: string) => fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
      const report = compareRuns(read(files[0]), read(files[1]));
      console.log(JSON.stringify(report, null, 2));
      if (!report.pairs.length) process.exitCode = 1;
    } catch { console.error("Could not read valid benchmark JSONL files."); process.exitCode = 1; }
  }
}
