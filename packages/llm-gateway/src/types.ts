import type { LlmGatewayError } from "./errors.js";

export type LlmRouteClass =
  | "utility"
  | "default"
  | "analysis"
  | "coding"
  | "review"
  | "fallback"
  | "mock";

export type LlmCallerClass =
  | "operator"
  | "internal_service"
  | "agent_runtime"
  | "workflow_node"
  | "operator_tool"
  | "external_api";

export interface JsonSchemaLike {
  type?: string;
  properties?: Record<string, JsonSchemaLike>;
  required?: string[];
  items?: JsonSchemaLike;
  enum?: unknown[];
  additionalProperties?: boolean;
}

export interface GenerateTextRequest {
  callerClass: LlmCallerClass;
  routeClass: LlmRouteClass;
  promptId: string;
  promptVersion: string;
  systemPrompt?: string;
  userPrompt: string;
  maxOutputTokens?: number;
  metadata?: Record<string, string>;
  allowFallback?: boolean;
}

export interface GenerateStructuredRequest<T> extends GenerateTextRequest {
  schema: JsonSchemaLike;
  repairOnFailure?: boolean;
  parseMode?: "strict_json" | "extract_json";
}

export interface GenerateTextResult {
  ok: true;
  text: string;
  provider: string;
  modelAlias: string;
  providerModel: string;
  requestId: string;
  fallbackUsed: boolean;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
  };
}

export interface GenerateStructuredResult<T> {
  ok: true;
  value: T;
  rawText: string;
  provider: string;
  modelAlias: string;
  providerModel: string;
  requestId: string;
  fallbackUsed: boolean;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
  };
}

export interface LlmGateway {
  generateText(request: GenerateTextRequest): Promise<GenerateTextResult | LlmGatewayError>;
  generateStructured<T>(
    request: GenerateStructuredRequest<T>
  ): Promise<GenerateStructuredResult<T> | LlmGatewayError>;
}

export function isRouteClass(value: string): value is LlmRouteClass {
  return ["utility", "default", "analysis", "coding", "review", "fallback", "mock"].includes(value);
}

export function isCallerClass(value: string): value is LlmCallerClass {
  return ["operator", "internal_service", "agent_runtime", "workflow_node", "operator_tool", "external_api"].includes(value);
}
