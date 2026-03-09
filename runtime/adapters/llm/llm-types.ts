export interface LLMInvokeInput {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMInvokeResponse {
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}
