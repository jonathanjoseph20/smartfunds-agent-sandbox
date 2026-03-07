import { randomUUID } from "node:crypto";
import { assertCallerRouteAccess } from "./access.js";
import { evaluateBudget, loadBudgetLimitsFromEnv, type BudgetLimits } from "./budget.js";
import type { AuditStore } from "./audit.js";
import { getSqliteAuditStore } from "./db.js";
import { gatewayError, isGatewayError, type LlmGatewayError } from "./errors.js";
import { createFakeProvider } from "./providers/fake.adapter.js";
import { createGoogleProvider } from "./providers/google.adapter.js";
import type { LlmProviderAdapter, ProviderStructuredRequest, ProviderTextRequest } from "./providers/base.js";
import { validatePromptMeta } from "./prompts.js";
import { loadModelRegistry, resolveModelByAlias, type ModelDefinition, type ModelRegistry } from "./registry.js";
import { loadRoutePolicy, resolveRoute, type RoutePolicy, type RouteResolution } from "./router.js";
import { parseAndValidateStructured } from "./schema.js";
import type {
  GenerateStructuredRequest,
  GenerateStructuredResult,
  GenerateTextRequest,
  GenerateTextResult,
  LlmGateway,
  LlmRouteClass
} from "./types.js";

export interface CreateGatewayOptions {
  registry?: ModelRegistry;
  routePolicy?: RoutePolicy;
  providers?: Record<string, LlmProviderAdapter>;
  auditStore?: AuditStore;
  budgetLimits?: BudgetLimits;
  now?: () => Date;
  requestIdFactory?: () => string;
  timeoutMs?: number;
}

type TextCallResult = { text: string; providerModel: string; usage?: GenerateTextResult["usage"] } | LlmGatewayError;
type StructuredCallResult = {
  rawText: string;
  providerModel: string;
  usage?: GenerateStructuredResult<unknown>["usage"];
} | LlmGatewayError;

type ExecutionTarget = {
  routeClass: LlmRouteClass;
  modelAlias: string;
  fallbackUsed: boolean;
};

function isErr(value: unknown): value is LlmGatewayError {
  return isGatewayError(value);
}

function defaultProviders(): Record<string, LlmProviderAdapter> {
  return {
    fake: createFakeProvider(),
    google: createGoogleProvider()
  };
}

function isProviderEnabled(providerId: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (providerId === "fake") {
    return env.LLM_ENABLE_PROVIDER_FAKE !== "0";
  }
  if (providerId === "google") {
    return env.LLM_ENABLE_PROVIDER_GOOGLE === "1";
  }
  return false;
}

function normalizeProviderError(error: unknown): LlmGatewayError {
  if (isGatewayError(error)) {
    return error;
  }

  return gatewayError("LLM_PROVIDER_ERROR", "Provider request failed", {
    message: error instanceof Error ? error.message : String(error)
  });
}

function buildProviderTextRequest(
  requestId: string,
  input: GenerateTextRequest,
  model: string,
  timeoutMs: number
): ProviderTextRequest {
  return {
    requestId,
    model,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    maxOutputTokens: input.maxOutputTokens,
    timeoutMs,
    metadata: input.metadata
  };
}

function buildProviderStructuredRequest<T>(
  requestId: string,
  input: GenerateStructuredRequest<T>,
  model: string,
  timeoutMs: number
): ProviderStructuredRequest {
  return {
    ...buildProviderTextRequest(requestId, input, model, timeoutMs),
    schema: input.schema
  };
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function shouldAttemptRepair<T>(request: GenerateStructuredRequest<T>, policy: RoutePolicy): boolean {
  return request.repairOnFailure === true && policy.routes[request.routeClass].allowFallback;
}

function writeAuditSafe(store: AuditStore, payload: Parameters<AuditStore["write"]>[0]): LlmGatewayError | null {
  try {
    store.write(payload);
    return null;
  } catch (error) {
    return gatewayError("LLM_AUDIT_WRITE_FAILED", "Failed writing LLM audit log", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function callProviderText(provider: LlmProviderAdapter, request: ProviderTextRequest): Promise<TextCallResult> {
  try {
    const response = await provider.generateText(request);
    return {
      text: response.text,
      providerModel: response.providerModel,
      usage: response.usage
    };
  } catch (error) {
    return normalizeProviderError(error);
  }
}

async function callProviderStructured(
  provider: LlmProviderAdapter,
  request: ProviderStructuredRequest
): Promise<StructuredCallResult> {
  try {
    const response = await provider.generateStructured(request);
    return {
      rawText: response.rawText,
      providerModel: response.providerModel,
      usage: response.usage
    };
  } catch (error) {
    return normalizeProviderError(error);
  }
}

function resolveExecutionTarget(
  request: GenerateTextRequest,
  resolution: RouteResolution,
  auditStore: AuditStore,
  budgets: BudgetLimits,
  now: () => Date
): ExecutionTarget | LlmGatewayError {
  const snapshot = auditStore.getSpendSnapshot(request.routeClass, nowIso(now));
  const budgetDecision = evaluateBudget(request.routeClass, snapshot, budgets, resolution.allowFallback);

  if (budgetDecision.ok) {
    return { routeClass: request.routeClass, modelAlias: resolution.primaryAlias, fallbackUsed: false };
  }

  if (budgetDecision.error?.code === "LLM_GLOBAL_BUDGET_EXCEEDED") {
    return budgetDecision.error;
  }

  if (budgetDecision.shouldDowngradeToFallback && resolution.fallbackAlias) {
    return { routeClass: "fallback", modelAlias: resolution.fallbackAlias, fallbackUsed: true };
  }

  return budgetDecision.error ?? gatewayError("LLM_BUDGET_EXCEEDED", "Budget exceeded");
}

function resolveModel(registry: ModelRegistry, alias: string): ModelDefinition | LlmGatewayError {
  const resolved = resolveModelByAlias(registry, alias);
  return isErr(resolved) ? resolved : resolved;
}

function resolveProviderOrFallback(
  primaryModel: ModelDefinition,
  executionTarget: ExecutionTarget,
  routeResolution: RouteResolution,
  registry: ModelRegistry,
  providers: Record<string, LlmProviderAdapter>
): { model: ModelDefinition; provider: LlmProviderAdapter; routeClass: LlmRouteClass; fallbackUsed: boolean } | LlmGatewayError {
  const primaryEnabled = isProviderEnabled(primaryModel.provider);
  const primaryProvider = providers[primaryModel.provider];

  if (primaryEnabled && primaryProvider) {
    return {
      model: primaryModel,
      provider: primaryProvider,
      routeClass: executionTarget.routeClass,
      fallbackUsed: executionTarget.fallbackUsed
    };
  }

  if (!routeResolution.allowFallback || executionTarget.fallbackUsed || !routeResolution.fallbackAlias) {
    return gatewayError("LLM_PROVIDER_DISABLED", "Provider is disabled by environment", {
      provider: primaryModel.provider
    });
  }

  const fallbackModel = resolveModel(registry, routeResolution.fallbackAlias);
  if (isErr(fallbackModel)) {
    return fallbackModel;
  }

  if (!isProviderEnabled(fallbackModel.provider)) {
    return gatewayError("LLM_PROVIDER_DISABLED", "Fallback provider is disabled by environment", {
      provider: fallbackModel.provider
    });
  }

  const fallbackProvider = providers[fallbackModel.provider];
  if (!fallbackProvider) {
    return gatewayError("LLM_PROVIDER_DISABLED", "Fallback provider adapter is not available", {
      provider: fallbackModel.provider
    });
  }

  return {
    model: fallbackModel,
    provider: fallbackProvider,
    routeClass: "fallback",
    fallbackUsed: true
  };
}

function resolveCore(
  request: GenerateTextRequest,
  registry: ModelRegistry,
  routePolicy: RoutePolicy,
  auditStore: AuditStore,
  budgets: BudgetLimits,
  now: () => Date
): { routeResolution: RouteResolution; executionTarget: ExecutionTarget; model: ModelDefinition } | LlmGatewayError {
  const promptValidation = validatePromptMeta({ promptId: request.promptId, promptVersion: request.promptVersion });
  if (promptValidation) return promptValidation;

  const accessError = assertCallerRouteAccess(request.callerClass, request.routeClass);
  if (accessError) return accessError;

  const routeResolution = resolveRoute(
    {
      callerClass: request.callerClass,
      routeClass: request.routeClass,
      requestAllowFallback: request.allowFallback
    },
    routePolicy,
    registry
  );
  if (isErr(routeResolution)) return routeResolution;

  const executionTarget = resolveExecutionTarget(request, routeResolution, auditStore, budgets, now);
  if (isErr(executionTarget)) return executionTarget;

  const model = resolveModel(registry, executionTarget.modelAlias);
  if (isErr(model)) return model;

  return { routeResolution, executionTarget, model };
}

export function createLlmGateway(options: CreateGatewayOptions = {}): LlmGateway {
  const loadedRegistry = options.registry ?? loadModelRegistry();
  const loadedPolicy = options.routePolicy ?? loadRoutePolicy();
  const providers = options.providers ?? defaultProviders();
  const auditStore = options.auditStore ?? getSqliteAuditStore();
  const budgets = options.budgetLimits ?? loadBudgetLimitsFromEnv();
  const clock = options.now ?? (() => new Date());
  const requestIdFactory = options.requestIdFactory ?? (() => randomUUID());
  const timeoutMs = options.timeoutMs ?? 15_000;

  const registryError = isErr(loadedRegistry) ? loadedRegistry : null;
  const policyError = isErr(loadedPolicy) ? loadedPolicy : null;
  const registry = isErr(loadedRegistry) ? null : loadedRegistry;
  const routePolicy = isErr(loadedPolicy) ? null : loadedPolicy;

  return {
    async generateText(request: GenerateTextRequest): Promise<GenerateTextResult | LlmGatewayError> {
      if (registryError) return registryError;
      if (policyError) return policyError;
      if (!registry || !routePolicy) {
        return gatewayError("LLM_PROVIDER_ERROR", "Gateway initialization failed");
      }

      const core = resolveCore(request, registry, routePolicy, auditStore, budgets, clock);
      if (isErr(core)) return core;

      const selected = resolveProviderOrFallback(core.model, core.executionTarget, core.routeResolution, registry, providers);
      if (isErr(selected)) return selected;

      const requestId = requestIdFactory();
      const startedAt = clock().getTime();

      let result = await callProviderText(
        selected.provider,
        buildProviderTextRequest(requestId, request, selected.model.model, timeoutMs)
      );

      if (isErr(result) && core.routeResolution.allowFallback && !selected.fallbackUsed && core.routeResolution.fallbackAlias) {
        const fallbackModel = resolveModel(registry, core.routeResolution.fallbackAlias);
        if (!isErr(fallbackModel) && isProviderEnabled(fallbackModel.provider)) {
          const fallbackProvider = providers[fallbackModel.provider];
          if (fallbackProvider) {
            const fallbackResult = await callProviderText(
              fallbackProvider,
              buildProviderTextRequest(requestId, request, fallbackModel.model, timeoutMs)
            );

            if (!isErr(fallbackResult)) {
              const auditError = writeAuditSafe(auditStore, {
                requestId,
                callerClass: request.callerClass,
                routeClass: "fallback",
                provider: fallbackModel.provider,
                modelAlias: fallbackModel.id,
                providerModel: fallbackResult.providerModel,
                promptId: request.promptId,
                promptVersion: request.promptVersion,
                status: "success",
                fallbackUsed: true,
                inputTokens: fallbackResult.usage?.inputTokens,
                outputTokens: fallbackResult.usage?.outputTokens,
                estimatedCostUsd: fallbackResult.usage?.estimatedCostUsd,
                latencyMs: clock().getTime() - startedAt,
                createdAt: nowIso(clock)
              });

              if (auditError) return auditError;

              return {
                ok: true,
                text: fallbackResult.text,
                provider: fallbackModel.provider,
                modelAlias: fallbackModel.id,
                providerModel: fallbackResult.providerModel,
                requestId,
                fallbackUsed: true,
                usage: fallbackResult.usage
              };
            }

            result = fallbackResult;
          }
        }
      }

      if (isErr(result)) {
        const auditError = writeAuditSafe(auditStore, {
          requestId,
          callerClass: request.callerClass,
          routeClass: selected.routeClass,
          provider: selected.model.provider,
          modelAlias: selected.model.id,
          providerModel: selected.model.model,
          promptId: request.promptId,
          promptVersion: request.promptVersion,
          status: "error",
          fallbackUsed: selected.fallbackUsed,
          errorCode: result.code,
          latencyMs: clock().getTime() - startedAt,
          createdAt: nowIso(clock)
        });
        if (auditError) return auditError;
        return result;
      }

      const auditError = writeAuditSafe(auditStore, {
        requestId,
        callerClass: request.callerClass,
        routeClass: selected.routeClass,
        provider: selected.model.provider,
        modelAlias: selected.model.id,
        providerModel: result.providerModel,
        promptId: request.promptId,
        promptVersion: request.promptVersion,
        status: "success",
        fallbackUsed: selected.fallbackUsed,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        estimatedCostUsd: result.usage?.estimatedCostUsd,
        latencyMs: clock().getTime() - startedAt,
        createdAt: nowIso(clock)
      });
      if (auditError) return auditError;

      return {
        ok: true,
        text: result.text,
        provider: selected.model.provider,
        modelAlias: selected.model.id,
        providerModel: result.providerModel,
        requestId,
        fallbackUsed: selected.fallbackUsed,
        usage: result.usage
      };
    },

    async generateStructured<T>(
      request: GenerateStructuredRequest<T>
    ): Promise<GenerateStructuredResult<T> | LlmGatewayError> {
      if (registryError) return registryError;
      if (policyError) return policyError;
      if (!registry || !routePolicy) {
        return gatewayError("LLM_PROVIDER_ERROR", "Gateway initialization failed");
      }

      const core = resolveCore(request, registry, routePolicy, auditStore, budgets, clock);
      if (isErr(core)) return core;

      if (!core.model.supportsStructured) {
        return gatewayError("LLM_PROVIDER_ERROR", "Model does not support structured generation", {
          modelAlias: core.model.id
        });
      }

      const selected = resolveProviderOrFallback(core.model, core.executionTarget, core.routeResolution, registry, providers);
      if (isErr(selected)) return selected;

      if (!selected.model.supportsStructured) {
        return gatewayError("LLM_PROVIDER_ERROR", "Selected model does not support structured generation", {
          modelAlias: selected.model.id
        });
      }

      const requestId = requestIdFactory();
      const startedAt = clock().getTime();

      let providerResult = await callProviderStructured(
        selected.provider,
        buildProviderStructuredRequest(requestId, request, selected.model.model, timeoutMs)
      );

      if (isErr(providerResult)) {
        const auditError = writeAuditSafe(auditStore, {
          requestId,
          callerClass: request.callerClass,
          routeClass: selected.routeClass,
          provider: selected.model.provider,
          modelAlias: selected.model.id,
          providerModel: selected.model.model,
          promptId: request.promptId,
          promptVersion: request.promptVersion,
          status: "error",
          fallbackUsed: selected.fallbackUsed,
          errorCode: providerResult.code,
          latencyMs: clock().getTime() - startedAt,
          createdAt: nowIso(clock)
        });
        if (auditError) return auditError;
        return providerResult;
      }

      let parsed = parseAndValidateStructured<T>(providerResult.rawText, request.schema, request.parseMode);
      if (isErr(parsed) && shouldAttemptRepair(request, routePolicy)) {
        const repairedPrompt: GenerateStructuredRequest<T> = {
          ...request,
          userPrompt: `${request.userPrompt}\n\nRepair instruction: return strict JSON only, matching schema exactly.`
        };

        const repaired = await callProviderStructured(
          selected.provider,
          buildProviderStructuredRequest(requestId, repairedPrompt, selected.model.model, timeoutMs)
        );

        if (!isErr(repaired)) {
          providerResult = repaired;
          parsed = parseAndValidateStructured<T>(repaired.rawText, request.schema, request.parseMode);
        }
      }

      if (isErr(parsed)) {
        const auditError = writeAuditSafe(auditStore, {
          requestId,
          callerClass: request.callerClass,
          routeClass: selected.routeClass,
          provider: selected.model.provider,
          modelAlias: selected.model.id,
          providerModel: providerResult.providerModel,
          promptId: request.promptId,
          promptVersion: request.promptVersion,
          status: "error",
          fallbackUsed: selected.fallbackUsed,
          errorCode: parsed.code,
          inputTokens: providerResult.usage?.inputTokens,
          outputTokens: providerResult.usage?.outputTokens,
          estimatedCostUsd: providerResult.usage?.estimatedCostUsd,
          latencyMs: clock().getTime() - startedAt,
          createdAt: nowIso(clock)
        });
        if (auditError) return auditError;
        return parsed;
      }

      const auditError = writeAuditSafe(auditStore, {
        requestId,
        callerClass: request.callerClass,
        routeClass: selected.routeClass,
        provider: selected.model.provider,
        modelAlias: selected.model.id,
        providerModel: providerResult.providerModel,
        promptId: request.promptId,
        promptVersion: request.promptVersion,
        status: "success",
        fallbackUsed: selected.fallbackUsed,
        inputTokens: providerResult.usage?.inputTokens,
        outputTokens: providerResult.usage?.outputTokens,
        estimatedCostUsd: providerResult.usage?.estimatedCostUsd,
        latencyMs: clock().getTime() - startedAt,
        createdAt: nowIso(clock)
      });
      if (auditError) return auditError;

      return {
        ok: true,
        value: parsed.value,
        rawText: parsed.rawText,
        provider: selected.model.provider,
        modelAlias: selected.model.id,
        providerModel: providerResult.providerModel,
        requestId,
        fallbackUsed: selected.fallbackUsed,
        usage: providerResult.usage
      };
    }
  };
}
