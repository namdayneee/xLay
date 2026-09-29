const LEADING_FILLERS = [
  /^\s*(?:bạn\s+có\s+thể\s+)?giúp\s+(?:tôi|mình)\s+/iu,
  /^\s*(?:ban\s+co\s+the\s+)?giup\s+(?:toi|minh)\s+/iu,
  /^\s*please\s+/iu,
];

export function compactUserMessage(input: string, safeToCompact: number): string {
  let value = input;
  // Formatting, quoted literals and code may be acceptance criteria.
  if (!Number.isFinite(safeToCompact) || safeToCompact < 0.9 || /[\r\n`"'“”‘’]/u.test(input)) return input;

  for (const pattern of LEADING_FILLERS) value = value.replace(pattern, "");
  // A trailing word may be literal task content, so never remove it.
  return value.trim() ? value : input;
}
