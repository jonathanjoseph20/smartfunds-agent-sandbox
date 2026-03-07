import { describe, expect, it } from "vitest";
import { evaluateBudget } from "../src/budget.js";

describe("budget", () => {
  const limits = {
    globalDailyBudgetUsd: 2,
    globalMonthlyBudgetUsd: 25,
    routeDailyBudgetUsd: {
      utility: 0.5,
      default: 1,
      analysis: 0.75,
      coding: 0.5,
      review: 0,
      fallback: undefined,
      mock: undefined
    }
  };

  it("route budget deny for coding route (T-B1)", () => {
    const decision = evaluateBudget(
      "coding",
      { globalDailySpentUsd: 0.1, globalMonthlySpentUsd: 1, routeDailySpentUsd: 0.5 },
      limits,
      true
    );

    expect(decision).toMatchObject({ ok: false, shouldDowngradeToFallback: false });
    expect(decision.error?.code).toBe("LLM_BUDGET_EXCEEDED");
  });

  it("global budget deny (T-B2)", () => {
    const decision = evaluateBudget(
      "default",
      { globalDailySpentUsd: 2, globalMonthlySpentUsd: 10, routeDailySpentUsd: 0.1 },
      limits,
      true
    );

    expect(decision.error?.code).toBe("LLM_GLOBAL_BUDGET_EXCEEDED");
  });

  it("utility/default/analysis downgrade behavior when allowed (T-B3)", () => {
    const decision = evaluateBudget(
      "utility",
      { globalDailySpentUsd: 0.2, globalMonthlySpentUsd: 1, routeDailySpentUsd: 0.6 },
      limits,
      true
    );

    expect(decision).toEqual({ ok: false, shouldDowngradeToFallback: true });
  });

  it("coding/review fail closed behavior (T-B4)", () => {
    const codingDecision = evaluateBudget(
      "coding",
      { globalDailySpentUsd: 0.2, globalMonthlySpentUsd: 1, routeDailySpentUsd: 0.8 },
      limits,
      true
    );

    const reviewDecision = evaluateBudget(
      "review",
      { globalDailySpentUsd: 0.2, globalMonthlySpentUsd: 1, routeDailySpentUsd: 0 },
      limits,
      true
    );

    expect(codingDecision.shouldDowngradeToFallback).toBe(false);
    expect(reviewDecision.shouldDowngradeToFallback).toBe(false);
    expect(codingDecision.error?.code).toBe("LLM_BUDGET_EXCEEDED");
    expect(reviewDecision.error?.code).toBe("LLM_BUDGET_EXCEEDED");
  });
});
