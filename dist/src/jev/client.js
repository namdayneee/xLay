import { localFallbackDecision } from "./fallback.js";
function bounded(n, fallback = 0) {
    const value = typeof n === "number" && Number.isFinite(n) ? n : fallback;
    return Math.max(0, Math.min(1, value));
}
function choiceAnswer(answers, key, fallback) {
    const answer = answers?.[key] ?? {};
    return {
        value: typeof answer.choice === "string" ? answer.choice : fallback,
        confidence: bounded(answer.confidence, 0.5),
    };
}
export async function analyzeWithJev(options) {
    if (!options.config.jev.enabled || !options.apiKey)
        return localFallbackDecision(options.input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.config.jev.timeoutMs);
    try {
        const response = await fetch(options.endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${options.apiKey}`,
                "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: options.config.jev.model,
                state: {
                    user_request: options.input,
                    coding_agent: options.agent,
                    repository: options.repo.repoName,
                    candidate_paths: options.repo.candidateFiles,
                },
                questions: {
                    task_type: {
                        type: "choice",
                        instructions: "Classify the primary coding task requested by the user.",
                        criteria: {
                            bug_fix: "Find or repair incorrect behavior.",
                            feature: "Add new behavior or capability.",
                            refactor: "Restructure existing code while preserving intended behavior.",
                            explain: "Explain or teach without primarily changing code.",
                            review: "Inspect or review code for issues without primarily implementing a feature.",
                            other: "None of the other labels fits well.",
                        },
                    },
                    action_mode: {
                        type: "choice",
                        instructions: "Should the coding agent change files now, inspect without editing, or only explain? Respect explicit wording in the user request.",
                        criteria: {
                            act: "The user wants implementation, fixing, editing, or execution.",
                            inspect_only: "The user wants investigation/review and no edits yet.",
                            explain_only: "The user wants explanation/teaching only.",
                        },
                    },
                    scope: {
                        type: "choice",
                        instructions: "How broad should the implementation scope be?",
                        criteria: {
                            minimal: "Smallest safe patch; avoid unrelated changes.",
                            focused: "Work in the directly relevant area and related tests.",
                            broad: "Repository-wide or architectural work is explicitly needed.",
                        },
                    },
                    needs_validation: {
                        type: "noul",
                        instructions: "Should the coding agent run relevant tests, build, lint, typecheck, or another validation before declaring completion?",
                    },
                    ambiguity: {
                        type: "score",
                        instructions: "How ambiguous is the user's request for a coding agent?",
                        criteria: ["clear", "minor ambiguity", "meaningful ambiguity", "highly ambiguous"],
                    },
                    safe_to_compact: {
                        type: "noul",
                        instructions: "Can polite/filler wording be removed while preserving every material goal, restriction, and acceptance condition in the user's request?",
                    },
                },
            }),
        });
        if (!response.ok)
            throw new Error(`Jev HTTP ${response.status}`);
        const payload = (await response.json());
        const answers = payload.answers ?? {};
        const task = choiceAnswer(answers, "task_type", "other");
        const action = choiceAnswer(answers, "action_mode", "act");
        const scope = choiceAnswer(answers, "scope", "focused");
        const ambiguityAnswer = answers.ambiguity ?? {};
        return {
            taskType: {
                value: ["bug_fix", "feature", "refactor", "explain", "review", "other"].includes(task.value)
                    ? task.value
                    : "other",
                confidence: task.confidence,
            },
            actionMode: {
                value: ["act", "inspect_only", "explain_only"].includes(action.value)
                    ? action.value
                    : "act",
                confidence: action.confidence,
            },
            scope: {
                value: ["minimal", "focused", "broad"].includes(scope.value)
                    ? scope.value
                    : "focused",
                confidence: scope.confidence,
            },
            needsValidation: bounded(answers.needs_validation?.noul, 0.5),
            ambiguity: {
                score: typeof ambiguityAnswer.score === "number" && Number.isFinite(ambiguityAnswer.score)
                    ? ambiguityAnswer.score
                    : 1.5,
                confidence: bounded(ambiguityAnswer.confidence, 0.5),
            },
            safeToCompact: bounded(answers.safe_to_compact?.noul, 0.5),
            source: "api",
            usage: {
                inputTokens: payload.usage?.input_tokens,
                outputTokens: payload.usage?.output_tokens,
                creditsUsed: payload.credits_used,
            },
        };
    }
    catch {
        return localFallbackDecision(options.input);
    }
    finally {
        clearTimeout(timer);
    }
}
//# sourceMappingURL=client.js.map