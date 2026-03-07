import { gatewayError, type LlmGatewayError } from "./errors.js";
import type { JsonSchemaLike } from "./types.js";
import { validateAgainstSchema } from "./validators/structured.js";

export interface ParsedStructuredValue<T> {
  value: T;
  rawText: string;
}

function extractJsonSnippet(text: string): string {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export function parseAndValidateStructured<T>(
  rawText: string,
  schema: JsonSchemaLike,
  parseMode: "strict_json" | "extract_json" = "strict_json"
): ParsedStructuredValue<T> | LlmGatewayError {
  const candidate = parseMode === "extract_json" ? extractJsonSnippet(rawText) : rawText.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return gatewayError("LLM_INVALID_JSON", "Provider did not return valid JSON", {
      rawText: rawText.slice(0, 500)
    });
  }

  const validation = validateAgainstSchema(parsed, schema, "$");
  if (!validation.ok) {
    return gatewayError("LLM_SCHEMA_VALIDATION_FAILED", "Structured response failed schema validation", {
      reason: validation.reason,
      path: validation.path
    });
  }

  return {
    value: parsed as T,
    rawText
  };
}
