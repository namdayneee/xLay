const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "cai",
  "cho",
  "co",
  "cua",
  "do",
  "duoc",
  "giup",
  "i",
  "is",
  "it",
  "la",
  "lam",
  "minh",
  "mot",
  "nay",
  "nhe",
  "nha",
  "of",
  "please",
  "sao",
  "the",
  "thi",
  "this",
  "toi",
  "va",
  "voi",
  "you",
]);

function asciiFold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function extractKeywords(input: string): string[] {
  const normalized = asciiFold(input)
    .replace(/[^a-z0-9_./-]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  return [...new Set(normalized)].slice(0, 16);
}

export function scorePath(filePath: string, keywords: string[]): number {
  const p = asciiFold(filePath);
  let score = 0;
  for (const keyword of keywords) {
    if (p === keyword) score += 12;
    else if (p.includes(`/${keyword}`) || p.includes(`${keyword}.`)) score += 8;
    else if (p.includes(keyword)) score += 4;
  }
  if (/test|spec/.test(p)) score += keywords.some((k) => /test|spec/.test(k)) ? 4 : 0;
  if (/node_modules|dist|build|coverage|\.lock$/.test(p)) score -= 20;
  return score;
}
