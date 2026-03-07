import fs from "node:fs";
import path from "node:path";
import { gatewayError, type LlmGatewayError } from "./errors.js";
import type { LlmRouteClass } from "./types.js";

export interface ModelDefinition {
  id: string;
  provider: string;
  model: string;
  enabled: boolean;
  supportsStructured: boolean;
  relativeCostTier: number;
  qualityTier: number;
  latencyTier: number;
}

export interface ModelRegistry {
  version: number;
  defaultRouteMap: Record<LlmRouteClass, string>;
  models: ModelDefinition[];
}

const DEFAULT_REGISTRY_PATH = "control-plane/llm/models.v1.json";

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

function toRouteMap(value: unknown): Record<LlmRouteClass, string> | null {
  if (!isRecord(value)) return null;
  const keys: LlmRouteClass[] = ["utility", "default", "analysis", "coding", "review", "fallback", "mock"];
  const map = {} as Record<LlmRouteClass, string>;

  for (const key of keys) {
    const alias = value[key];
    if (typeof alias !== "string" || alias.trim().length === 0) {
      return null;
    }
    map[key] = alias;
  }

  return map;
}

function toModelDefinition(value: unknown): ModelDefinition | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.provider !== "string") return null;
  if (typeof value.model !== "string") return null;
  if (typeof value.enabled !== "boolean") return null;
  if (typeof value.supportsStructured !== "boolean") return null;
  if (typeof value.relativeCostTier !== "number") return null;
  if (typeof value.qualityTier !== "number") return null;
  if (typeof value.latencyTier !== "number") return null;

  return {
    id: value.id,
    provider: value.provider,
    model: value.model,
    enabled: value.enabled,
    supportsStructured: value.supportsStructured,
    relativeCostTier: value.relativeCostTier,
    qualityTier: value.qualityTier,
    latencyTier: value.latencyTier
  };
}

export function loadModelRegistry(registryPath = process.env.LLM_REGISTRY_PATH ?? DEFAULT_REGISTRY_PATH): ModelRegistry | LlmGatewayError {
  try {
    const raw = readJsonFile(registryPath);
    if (!isRecord(raw)) {
      return gatewayError("LLM_MODEL_NOT_FOUND", "Model registry must be an object", { registryPath });
    }

    const routeMap = toRouteMap(raw.defaultRouteMap);
    if (!routeMap) {
      return gatewayError("LLM_MODEL_NOT_FOUND", "Model registry defaultRouteMap is invalid", { registryPath });
    }

    if (!Array.isArray(raw.models)) {
      return gatewayError("LLM_MODEL_NOT_FOUND", "Model registry models must be an array", { registryPath });
    }

    const models: ModelDefinition[] = [];
    for (const entry of raw.models) {
      const model = toModelDefinition(entry);
      if (!model) {
        return gatewayError("LLM_MODEL_NOT_FOUND", "Model registry has invalid model definition", { registryPath });
      }
      models.push(model);
    }

    return {
      version: typeof raw.version === "number" ? raw.version : 0,
      defaultRouteMap: routeMap,
      models
    };
  } catch (error) {
    return gatewayError("LLM_MODEL_NOT_FOUND", "Unable to load model registry", {
      registryPath,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

export function resolveModelAlias(registry: ModelRegistry, routeClass: LlmRouteClass): string | LlmGatewayError {
  const alias = registry.defaultRouteMap[routeClass];
  if (!alias || alias === "disabled") {
    return gatewayError("LLM_ROUTE_DISABLED", "Route is disabled in model registry", {
      routeClass
    });
  }
  return alias;
}

export function resolveModelByAlias(registry: ModelRegistry, alias: string): ModelDefinition | LlmGatewayError {
  const model = registry.models.find((item) => item.id === alias);
  if (!model) {
    return gatewayError("LLM_MODEL_NOT_FOUND", "Model alias not found", { alias });
  }

  if (!model.enabled) {
    return gatewayError("LLM_PROVIDER_DISABLED", "Model alias is disabled", {
      alias,
      provider: model.provider
    });
  }

  return model;
}
