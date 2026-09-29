import { localFallbackDecision } from "./jev/fallback.js";
// Jev supplies signals; only this local policy can authorize dispatch and budgets.
// Agent selection, session ownership and permission settings are never model-controlled.
export function resolvePolicy(input, decision, maxFiles) {
    const local = localFallbackDecision(input);
    const reasons = [];
    let mode = decision.actionMode.value;
    if (local.actionMode.value !== "act") {
        mode = local.actionMode.value;
        reasons.push("local read-only intent");
    }
    const uncertainAction = decision.source === "api" && decision.actionMode.confidence < 0.7;
    const ambiguous = decision.ambiguity.confidence >= 0.7 && decision.ambiguity.score >= 2.5;
    const dispatch = uncertainAction || ambiguous ? "clarify" : "run";
    if (uncertainAction)
        reasons.push("uncertain action mode");
    if (ambiguous)
        reasons.push("ambiguous request");
    const scope = local.scope.value === "minimal" ? "minimal"
        : decision.scope.confidence >= 0.7 ? decision.scope.value : local.scope.value;
    const cap = Number.isFinite(maxFiles) ? Math.max(0, Math.min(50, Math.floor(maxFiles))) : 6;
    const contextLimit = Math.min(cap, scope === "minimal" ? 2 : scope === "focused" ? 6 : cap);
    return {
        dispatch, mode, scope, contextLimit,
        compact: dispatch === "run" && decision.source === "api" && decision.safeToCompact >= 0.9,
        validation: mode === "act" || decision.needsValidation >= 0.7 ? "relevant" : "on_request",
        reasons,
    };
}
//# sourceMappingURL=policy.js.map