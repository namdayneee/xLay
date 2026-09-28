export type AgentName = "claude" | "codex";

export type JevSource = "api" | "local-fallback";

export interface JevDecision {
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
    creditsUsed?: number;
  };
}

export interface RepoContext {
  repoName: string;
  cwd: string;
  isGitRepo: boolean;
  candidateFiles: string[];
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
  jevApiKey?: string;
}
