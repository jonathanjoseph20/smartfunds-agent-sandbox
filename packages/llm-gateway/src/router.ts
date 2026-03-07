import fs from "node:fs";
import path from "node:path";
import { gatewayError, type LlmGatewayError } from "./errors.js";
import { resolveModelAlias, resolveModelByAlias, type ModelDefinition, type ModelRegistry } from "./registry.js";
import type { LlmCallerClass, LlmRouteClass } from "./types.js";

export interface RouteRule {
  enabled: boolean;
  allowFallback: boolean;
  maxCostTier?: number;
  allowedCallerClasses?: LlmCallerClass[];
}

export interface RoutePolicy {
  version: number;
  routes: Record<LlmRouteClass, RouteRule>;
}

export interface RouteResolution {
  primaryAlias: string;
  primaryModel: ModelDefinition;
  fallbackAlias?: string;
  fallbackModel?: ModelDefinition;
  allowFallback: boolean;
}

const DEFAULT_ROUTE_POLICY_PATH = "control-plane/llm/route-policy.v1.json";

function isErr(value: unknown): value is LlmGatewayError {
  return !!value && typeof value === "object" && (value as Record<string, unknown>).ok === false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readJsonFile(filePath: string): unknown {
  const resolved = resolveConfigPath(filePath);
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw) as unknown;
}

function resolveConfigPath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  let current = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(current, filePath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(filePath);
}

function toRouteRule(value: unknown): RouteRule | null {
  if (!isRecord(value)) return null;
  if (typeof value.enabled !== "boolean") return null;
  if (typeof value.allowFallback !== "boolean") return null;
  if (value.maxCostTier !== undefined && typeof value.maxCostTier !== "number") return null;
  if (
    value.allowedCallerClasses !== undefined
    && (!Array.isArray(value.allowedCallerClasses) || !value.allowedCallerClasses.every((entry) => typeof entry === "string"))
  ) {
    return null;
  }

  return {
    enabled: value.enabled,
    allowFallback: value.allowFallback,
    maxCostTier: value.maxCostTier,
    allowedCallerClasses: value.allowedCallerClasses as LlmCallerClass[] | undefined
  };
}

export function loadRoutePolicy(policyPath = process.env.LLM_ROUTE_POLICY_PATH ?? DEFAULT_ROUTE_POLICY_PATH): RoutePolicy | LlmGatewayError {
  try {
    const raw = readJsonFile(policyPath);
    if (!isRecord(raw) || !isRecord(raw.routes)) {
      return gatewayError("LLM_ROUTE_DISABLED", "Route policy is invalid", { policyPath });
    }

    const keys: LlmRouteClass[] = ["utility", "default", "analysis", "coding", "review", "fallback", "mock"];
    const routes = {} as Record<LlmRouteClass, RouteRule>;

    for (const key of keys) {
      const rule = toRouteRule(raw.routes[key]);
      if (!rule) {
        return gatewayError("LLM_ROUTE_DISABLED", "Route policy route definition is invalid", {
          policyPath,
          routeClass: key
        });
      }
      routes[key] = rule;
    }

    return {
      version: typeof raw.version === "number" ? raw.version : 0,
      routes
    };
  } catch (error) {
    return gatewayError("LLM_ROUTE_DISABLED", "Unable to load route policy", {
      policyPath,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export function resolveRoute(
  args: {
    callerClass: LlmCallerClass;
    routeClass: LlmRouteClass;
    requestAllowFallback?: boolean;
  },
  policy: RoutePolicy,
  registry: ModelRegistry
): RouteResolution | LlmGatewayError {
  const rule = policy.routes[args.routeClass];
  if (!rule.enabled) {
    return gatewayError("LLM_ROUTE_DISABLED", "Route is disabled by policy", { routeClass: args.routeClass });
  }

  if (rule.allowedCallerClasses && !rule.allowedCallerClasses.includes(args.callerClass)) {
    return gatewayError("LLM_ROUTE_NOT_ALLOWED", "Caller class is not allowed by route policy", {
      callerClass: args.callerClass,
      routeClass: args.routeClass
    });
  }

  const primaryAlias = resolveModelAlias(registry, args.routeClass);
  if (isErr(primaryAlias)) {
    return primaryAlias;
  }

  const primaryModel = resolveModelByAlias(registry, primaryAlias);
  if (isErr(primaryModel)) {
    return primaryModel;
  }

  if (rule.maxCostTier !== undefined && primaryModel.relativeCostTier > rule.maxCostTier) {
    return gatewayError("LLM_ROUTE_DISABLED", "Route model cost tier exceeds policy", {
      routeClass: args.routeClass,
      modelAlias: primaryAlias,
      modelCostTier: primaryModel.relativeCostTier,
      maxCostTier: rule.maxCostTier
    });
  }

  const fallbackAllowed = rule.allowFallback && args.requestAllowFallback !== false;
  if (!fallbackAllowed) {
    return {
      primaryAlias,
      primaryModel,
      allowFallback: false
    };
  }

  const fallbackAlias = resolveModelAlias(registry, "fallback");
  if (isErr(fallbackAlias)) {
    return {
      primaryAlias,
      primaryModel,
      allowFallback: false
    };
  }

  const fallbackModel = resolveModelByAlias(registry, fallbackAlias);
  if (isErr(fallbackModel)) {
    return {
      primaryAlias,
      primaryModel,
      allowFallback: false
    };
  }

  return {
    primaryAlias,
    primaryModel,
    fallbackAlias,
    fallbackModel,
    allowFallback: true
  };
}
