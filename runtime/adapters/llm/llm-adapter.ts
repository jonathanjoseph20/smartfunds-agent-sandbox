import { routeLLMRequest } from './llm-router.ts';
import type { LLMInvokeInput, LLMInvokeResponse } from './llm-types.ts';

export async function invokeLLM(input: LLMInvokeInput): Promise<LLMInvokeResponse> {
  const routed = await routeLLMRequest(input);

  return {
    model: routed.model,
    content: routed.content,
    usage: {
      promptTokens: routed.usage.promptTokens,
      completionTokens: routed.usage.completionTokens
    }
  };
}
