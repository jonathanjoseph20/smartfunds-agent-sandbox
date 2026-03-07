import { gatewayError, type LlmGatewayError } from "./errors.js";
import type { LlmRouteClass } from "./types.js";

export interface BudgetSnapshot {
  globalDailySpentUsd: number;
  globalMonthlySpentUsd: number;
  routeDailySpentUsd: number;
}

export interface BudgetLimits {
  globalDailyBudgetUsd: number;
  globalMonthlyBudgetUsd: number;
  routeDailyBudgetUsd: Partial<Record<LlmRouteClass, number>>;
}

export interface BudgetDecision {
  ok: boolean;
  shouldDowngradeToFallback: boolean;
  error?: LlmGatewayError;
}

export function loadBudgetLimitsFromEnv(env: NodeJS.ProcessEnv = process.env): BudgetLimits {
  const read = (key: string, fallback: number): number => {
    const raw = env[key];
    if (raw === undefined || raw.trim().length === 0) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    globalDailyBudgetUsd: read("LLM_DAILY_BUDGET_USD", 2),
    globalMonthlyBudgetUsd: read("LLM_MONTHLY_BUDGET_USD", 25),
    routeDailyBudgetUsd: {
      utility: read("LLM_ROUTE_UTILITY_DAILY_BUDGET_USD", 0.5),
      default: read("LLM_ROUTE_DEFAULT_DAILY_BUDGET_USD", 1),
      analysis: read("LLM_ROUTE_ANALYSIS_DAILY_BUDGET_USD", 0.75),
      coding: read("LLM_ROUTE_CODING_DAILY_BUDGET_USD", 0.5),
      review: read("LLM_ROUTE_REVIEW_DAILY_BUDGET_USD", 0),
      fallback: undefined,
      mock: undefined
    }
  };
}

function isDowngradeRoute(routeClass: LlmRouteClass): boolean {
  return routeClass === "utility" || routeClass === "default" || routeClass === "analysis";
}

export function evaluateBudget(
  routeClass: LlmRouteClass,
  snapshot: BudgetSnapshot,
  limits: BudgetLimits,
  allowFallback: boolean
): BudgetDecision {
  if (snapshot.globalDailySpentUsd >= limits.globalDailyBudgetUsd || snapshot.globalMonthlySpentUsd >= limits.globalMonthlyBudgetUsd) {
    return {
      ok: false,
      shouldDowngradeToFallback: false,
      error: gatewayError("LLM_GLOBAL_BUDGET_EXCEEDED", "Global LLM budget exceeded", {
        routeClass,
        globalDailySpentUsd: snapshot.globalDailySpentUsd,
        globalMonthlySpentUsd: snapshot.globalMonthlySpentUsd,
        globalDailyBudgetUsd: limits.globalDailyBudgetUsd,
        globalMonthlyBudgetUsd: limits.globalMonthlyBudgetUsd
      })
    };
  }

  const routeBudget = limits.routeDailyBudgetUsd[routeClass];
  if (routeBudget === undefined) {
    return { ok: true, shouldDowngradeToFallback: false };
  }

  if (snapshot.routeDailySpentUsd < routeBudget) {
    return { ok: true, shouldDowngradeToFallback: false };
  }

  if (allowFallback && isDowngradeRoute(routeClass)) {
    return {
      ok: false,
      shouldDowngradeToFallback: true
    };
  }

  return {
    ok: false,
    shouldDowngradeToFallback: false,
    error: gatewayError("LLM_BUDGET_EXCEEDED", "Route budget exceeded", {
      routeClass,
      routeDailySpentUsd: snapshot.routeDailySpentUsd,
      routeDailyBudgetUsd: routeBudget
    })
  };
}
