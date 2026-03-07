import { gatewayError, type LlmGatewayError } from "./errors.js";

export interface PromptMeta {
  promptId: string;
  promptVersion: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validatePromptMeta(input: PromptMeta): LlmGatewayError | null {
  if (!isNonEmptyString(input.promptId)) {
    return gatewayError("LLM_PROVIDER_ERROR", "promptId is required");
  }

  if (!isNonEmptyString(input.promptVersion)) {
    return gatewayError("LLM_PROVIDER_ERROR", "promptVersion is required");
  }

  return null;
}
