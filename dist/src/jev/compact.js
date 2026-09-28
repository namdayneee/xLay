const LEADING_FILLERS = [
    /^\s*(?:bạn\s+)?có\s+thể\s+/iu,
    /^\s*(?:ban\s+)?co\s+the\s+/iu,
    /^\s*giúp\s+(?:tôi|mình)\s+/iu,
    /^\s*giup\s+(?:toi|minh)\s+/iu,
    /^\s*please\s+/iu,
];
const TRAILING_FILLERS = [/(?:\s+)(?:nhé|nha|với)\s*[.!?]*$/iu, /(?:\s+)(?:nhe|nha|voi)\s*[.!?]*$/iu];
export function compactUserMessage(input, safeToCompact) {
    let value = input.replace(/\s+/g, " ").trim();
    if (safeToCompact < 0.8)
        return value;
    for (const pattern of LEADING_FILLERS)
        value = value.replace(pattern, "");
    for (const pattern of TRAILING_FILLERS)
        value = value.replace(pattern, "");
    return value.trim();
}
//# sourceMappingURL=compact.js.map