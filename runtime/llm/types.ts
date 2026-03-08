export interface LLMPromptEnvelope {
  missionId: string;
  runId: string;
  workflowNodeId: string;
  teamId: string;
  agentId: string;
  taskType: string;
  inputs: Record<string, unknown>;
  constraints: string[];
  requestedArtifacts: string[];
  outputInstructions: string;
}

export interface LLMRequest {
  taskType: string;
  routeHint?: string;
  providerPreference?: string | null;
  outputMode: 'text' | 'json' | 'best-effort-json';
  promptEnvelope: LLMPromptEnvelope;
  maxTokens?: number;
}

export interface LLMResponse {
  provider: string;
  model: string;
  outputMode: 'text' | 'json' | 'best-effort-json';
  content: string;
  parsedJson?: Record<string, unknown> | null;
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
  };
  responseHash: string;
}
