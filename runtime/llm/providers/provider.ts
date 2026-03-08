import type { LLMPromptEnvelope, LLMRequest } from '../types.ts';

export interface ProviderInvokeRequest {
  model: string;
  outputMode: LLMRequest['outputMode'];
  promptEnvelope: LLMPromptEnvelope;
  maxTokens?: number;
}

export interface ProviderInvokeResponse {
  model: string;
  content: string;
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
  };
}

export interface LLMProvider {
  providerId: string;
  invoke(request: ProviderInvokeRequest): Promise<ProviderInvokeResponse>;
}
