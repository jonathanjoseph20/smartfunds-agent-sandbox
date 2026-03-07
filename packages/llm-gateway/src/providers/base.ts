import type { JsonSchemaLike } from "../types.js";

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

export interface ProviderTextRequest {
  requestId: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
}

export interface ProviderTextResult {
  text: string;
  providerModel: string;
  usage?: ProviderUsage;
}

export interface ProviderStructuredRequest extends ProviderTextRequest {
  schema: JsonSchemaLike;
}

export interface ProviderStructuredResult {
  rawText: string;
  providerModel: string;
  usage?: ProviderUsage;
}

export interface LlmProviderAdapter {
  readonly providerId: string;
  generateText(request: ProviderTextRequest): Promise<ProviderTextResult>;
  generateStructured(request: ProviderStructuredRequest): Promise<ProviderStructuredResult>;
}
