export type AgentName = "claude" | "codex";

export type JevSource = "api" | "local-fallback";

export interface TurnPolicy {
  dispatch: "run" | "clarify";
  mode: JevDecision["actionMode"]["value"];
  scope: JevDecision["scope"]["value"];
  contextLimit: number;
  compact: boolean;
  validation: "relevant" | "on_request";
  reasons: string[];
}

export interface JevDecision {
  model?: string;
  fallbackReason?: string;
  apiAttempted?: boolean;
  relevance?: Record<string, { score: number; confidence: number }>;
  taskType: {
    value: "bug_fix" | "feature" | "refactor" | "explain" | "review" | "other";
    confidence: number;
  };
  actionMode: {
    value: "act" | "inspect_only" | "explain_only";
    confidence: number;
  };
  scope: {
    value: "minimal" | "focused" | "broad";
    confidence: number;
  };
  needsValidation: number;
  ambiguity: {
    score: number;
    confidence: number;
  };
  safeToCompact: number;
  source: JevSource;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface RepoContext {
  root?: string;
  candidates?: ContextCandidate[];
  repoName: string;
  cwd: string;
  isGitRepo: boolean;
  candidateFiles: string[];
}

export interface ContextCandidate {
  localScore?: number;
  path: string;
  excerpt: string;
  fingerprint: string;
  explicit: boolean;
}

export interface TurnMetrics {
  requestChars: number;
  promptChars: number;
  candidateChars: number;
  selectedChars: number;
  reusedChars: number;
  selectedFiles: number;
  contextSource: "jev" | "local";
}

export interface AgentRunResult {
  sessionId?: string;
  exitCode: number;
  usage?: Record<string, unknown>;
}

export interface XLayConfig {
  version: 1;
  defaultAgent: AgentName;
  jev: {
    enabled: boolean;
    endpoint: string;
    model: string;
    timeoutMs: number;
  };
  context: {
    maxCandidateFiles: number;
  };
}

export interface XLayCredentials {
  typesafeApiKey?: string;
  jevApiKey?: string;
}
