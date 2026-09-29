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
function asciiFold(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
export function extractKeywords(input) {
    const normalized = asciiFold(input)
        .replace(/[^a-z0-9_./-]+/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
    const aliases = [
        [/đăng nhập|dang nhap|xác thực|xac thuc/iu, ["login", "auth", "session"]],
        [/thanh toán|thanh toan/iu, ["payment", "billing", "checkout"]],
        [/cơ sở dữ liệu|co so du lieu/iu, ["database", "schema", "migration"]],
        [/giao diện|giao dien/iu, ["ui", "view", "component"]],
        [/kiểm thử|kiem thu/iu, ["test", "spec"]],
    ];
    const expanded = aliases.filter(([pattern]) => pattern.test(input)).flatMap(([, words]) => words);
    return [...new Set([...expanded, ...normalized])].slice(0, 24);
}
export function scorePath(filePath, keywords) {
    const p = asciiFold(filePath);
    let score = 0;
    for (const keyword of keywords) {
        if (p === keyword)
            score += 12;
        else if (p.includes(`/${keyword}`) || p.includes(`${keyword}.`))
            score += 8;
        else if (p.includes(keyword))
            score += 4;
    }
    if (/test|spec/.test(p))
        score += keywords.some((k) => /test|spec/.test(k)) ? 4 : 0;
    if (/node_modules|dist|build|coverage|\.lock$/.test(p))
        score -= 20;
    return score;
}
//# sourceMappingURL=keywords.js.map