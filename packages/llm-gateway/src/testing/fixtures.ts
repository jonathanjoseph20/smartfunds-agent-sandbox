import type { GenerateStructuredRequest, GenerateTextRequest, JsonSchemaLike } from "../types.js";

export function baseTextRequest(overrides: Partial<GenerateTextRequest> = {}): GenerateTextRequest {
  return {
    callerClass: "internal_service",
    routeClass: "default",
    promptId: "prompt.test",
    promptVersion: "v1",
    userPrompt: "Hello",
    allowFallback: true,
    ...overrides
  };
}

export function baseSchema(): JsonSchemaLike {
  return {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string" }
    }
  };
}

export function baseStructuredRequest<T>(overrides: Partial<GenerateStructuredRequest<T>> = {}): GenerateStructuredRequest<T> {
  return {
    ...baseTextRequest(),
    schema: baseSchema(),
    ...overrides
  } as GenerateStructuredRequest<T>;
}
