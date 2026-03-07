import { gatewayError, type LlmGatewayError } from "./errors.js";
import type { LlmCallerClass, LlmRouteClass } from "./types.js";

export type AccessMatrix = Record<LlmCallerClass, ReadonlySet<LlmRouteClass>>;

const DEFAULT_MATRIX: AccessMatrix = {
  operator: new Set(["utility", "default", "analysis", "coding", "review", "fallback", "mock"]),
  internal_service: new Set(["utility", "default", "analysis", "coding", "fallback", "mock"]),
  agent_runtime: new Set(["utility", "default", "analysis", "fallback", "mock"]),
  workflow_node: new Set(["utility", "default", "analysis", "fallback", "mock"]),
  operator_tool: new Set(["utility", "default", "analysis", "coding", "review", "fallback", "mock"]),
  external_api: new Set(["utility", "default", "fallback"])
};

export function assertCallerRouteAccess(
  callerClass: LlmCallerClass,
  routeClass: LlmRouteClass,
  matrix: AccessMatrix = DEFAULT_MATRIX
): LlmGatewayError | null {
  const allowed = matrix[callerClass];
  if (!allowed || !allowed.has(routeClass)) {
    return gatewayError("LLM_ROUTE_NOT_ALLOWED", "Caller class is not allowed to use route", {
      callerClass,
      routeClass
    });
  }
  return null;
}
