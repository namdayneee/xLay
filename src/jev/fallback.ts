import type { JevDecision } from "../types.js";

function has(input: string, pattern: RegExp): boolean {
  return pattern.test(input.toLowerCase());
}

export function localFallbackDecision(input: string, hasSession = false): JevDecision {
  let taskType: JevDecision["taskType"]["value"] = "other";
  if (has(input, /bug|fix|sua|sửa|loi|lỗi|sai|crash|hong|hỏng/)) taskType = "bug_fix";
  else if (has(input, /refactor|tai cau truc|tái cấu trúc/)) taskType = "refactor";
  else if (has(input, /review|kiem tra code|kiểm tra code/)) taskType = "review";
  else if (has(input, /giai thich|giải thích|why|tai sao|tại sao/)) taskType = "explain";
  else if (has(input, /them|thêm|feature|implement|tao|tạo/)) taskType = "feature";

  let actionMode: JevDecision["actionMode"]["value"] = "act";
  if (has(input, /chi giai thich|chỉ giải thích|explain only/)) actionMode = "explain_only";
  else if (has(input, /chi xem|chỉ xem|inspect only|khong sua gi|không sửa gì|dung sua code|đừng sửa code|không (?:sửa|đổi|thay đổi) (?:code|file|mã)|do not (?:edit|modify|change) (?:any )?(?:files|code)|don't (?:edit|modify|change) (?:files|code)|read.only/)) {
    actionMode = "inspect_only";
  }
  else {
    const wantsChanges = /(?:^|[\s,;])(?:fix|implement|add|create|edit|modify|refactor|sửa|sua|thêm|them|tạo|tao)(?:\s|$)/iu.test(input);
    if (!wantsChanges && has(input, /review|inspect|kiểm tra code|kiem tra code/)) actionMode = "inspect_only";
    else if (!wantsChanges && has(input, /explain|giải thích|giai thich|\bwhy\b|tại sao|tai sao/)) actionMode = "explain_only";
  }

  const scope: JevDecision["scope"]["value"] = has(input, /toi thieu|tối thiểu|minimal|it nhat|ít nhất/)
    ? "minimal"
    : has(input, /toan bo|toàn bộ|architecture|kien truc|kiến trúc/)
      ? "broad"
      : "focused";

  const needsValidation = has(input, /test|build|lint|verify|kiem tra|kiểm tra/) ? 0.95 : 0.55;
  const vague = !hasSession && /^(?:fix it|do it|sửa đi|làm đi|help|giúp tôi)[.!?]*$/iu.test(input.trim());
  const ambiguity = vague ? 3 : 1.3;

  return {
    taskType: { value: taskType, confidence: 0.65 },
    actionMode: { value: actionMode, confidence: 0.65 },
    scope: { value: scope, confidence: 0.65 },
    needsValidation,
    ambiguity: { score: ambiguity, confidence: vague ? 0.9 : 0.55 },
    safeToCompact: 0.55,
    source: "local-fallback",
  };
}
