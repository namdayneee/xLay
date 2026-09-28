import type { JevDecision } from "../types.js";

function has(input: string, pattern: RegExp): boolean {
  return pattern.test(input.toLowerCase());
}

export function localFallbackDecision(input: string): JevDecision {
  let taskType: JevDecision["taskType"]["value"] = "other";
  if (has(input, /bug|fix|sua|sửa|loi|lỗi|sai|crash|hong|hỏng/)) taskType = "bug_fix";
  else if (has(input, /refactor|tai cau truc|tái cấu trúc/)) taskType = "refactor";
  else if (has(input, /review|kiem tra code|kiểm tra code/)) taskType = "review";
  else if (has(input, /giai thich|giải thích|why|tai sao|tại sao/)) taskType = "explain";
  else if (has(input, /them|thêm|feature|implement|tao|tạo/)) taskType = "feature";

  let actionMode: JevDecision["actionMode"]["value"] = "act";
  if (has(input, /chi giai thich|chỉ giải thích|explain only/)) actionMode = "explain_only";
  else if (has(input, /chi xem|chỉ xem|inspect only|khong sua gi|không sửa gì|dung sua code|đừng sửa code/)) {
    actionMode = "inspect_only";
  }

  const scope: JevDecision["scope"]["value"] = has(input, /toan bo|toàn bộ|architecture|kien truc|kiến trúc/)
    ? "broad"
    : has(input, /toi thieu|tối thiểu|minimal|it nhat|ít nhất/)
      ? "minimal"
      : "focused";

  const needsValidation = has(input, /test|build|lint|verify|kiem tra|kiểm tra/) ? 0.95 : 0.55;
  const ambiguity = input.trim().length < 20 ? 2.8 : 1.3;

  return {
    taskType: { value: taskType, confidence: 0.65 },
    actionMode: { value: actionMode, confidence: 0.65 },
    scope: { value: scope, confidence: 0.65 },
    needsValidation,
    ambiguity: { score: ambiguity, confidence: 0.55 },
    safeToCompact: 0.55,
    source: "local-fallback",
  };
}
