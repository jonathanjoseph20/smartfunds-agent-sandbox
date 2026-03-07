export type LlmErrorCode =
  | "LLM_ROUTE_DISABLED"
  | "LLM_ROUTE_NOT_ALLOWED"
  | "LLM_MODEL_NOT_FOUND"
  | "LLM_PROVIDER_DISABLED"
  | "LLM_PROVIDER_TIMEOUT"
  | "LLM_PROVIDER_ERROR"
  | "LLM_BUDGET_EXCEEDED"
  | "LLM_GLOBAL_BUDGET_EXCEEDED"
  | "LLM_INVALID_JSON"
  | "LLM_SCHEMA_VALIDATION_FAILED"
  | "LLM_AUDIT_WRITE_FAILED";

export interface LlmGatewayError {
  ok: false;
  code: LlmErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export function gatewayError(
  code: LlmErrorCode,
  message: string,
  details?: Record<string, unknown>
): LlmGatewayError {
  return { ok: false, code, message, details };
}

export function isGatewayError(value: unknown): value is LlmGatewayError {
  return (
    !!value
    && typeof value === "object"
    && (value as Record<string, unknown>).ok === false
    && typeof (value as Record<string, unknown>).code === "string"
    && typeof (value as Record<string, unknown>).message === "string"
  );
}
