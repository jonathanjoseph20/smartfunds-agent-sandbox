import { describe, expect, it } from "vitest";
import { loadModelRegistry } from "../src/registry.js";
import { loadRoutePolicy, resolveRoute } from "../src/router.js";

describe("router", () => {
  it("disabled route rejects request (T-R1)", () => {
    const registry = loadModelRegistry("control-plane/llm/models.v1.json");
    const policy = loadRoutePolicy("control-plane/llm/route-policy.v1.json");

    if ("ok" in registry && registry.ok === false) throw new Error("registry failed");
    if ("ok" in policy && policy.ok === false) throw new Error("policy failed");

    const resolved = resolveRoute(
      { callerClass: "operator", routeClass: "review", requestAllowFallback: true },
      policy,
      registry
    );

    expect(resolved).toMatchObject({ ok: false, code: "LLM_ROUTE_DISABLED" });
  });

  it("route resolves correct model alias (T-R2)", () => {
    const registry = loadModelRegistry("control-plane/llm/models.v1.json");
    const policy = loadRoutePolicy("control-plane/llm/route-policy.v1.json");

    if ("ok" in registry && registry.ok === false) throw new Error("registry failed");
    if ("ok" in policy && policy.ok === false) throw new Error("policy failed");

    const resolved = resolveRoute(
      { callerClass: "internal_service", routeClass: "default", requestAllowFallback: true },
      policy,
      registry
    );

    if ("ok" in resolved && resolved.ok === false) throw new Error("route should resolve");
    expect(resolved.primaryAlias).toBe("google-flash-lite");
  });

  it("fallback chain resolves correctly (T-R3)", () => {
    const registry = loadModelRegistry("control-plane/llm/models.v1.json");
    const policy = loadRoutePolicy("control-plane/llm/route-policy.v1.json");

    if ("ok" in registry && registry.ok === false) throw new Error("registry failed");
    if ("ok" in policy && policy.ok === false) throw new Error("policy failed");

    const resolved = resolveRoute(
      { callerClass: "operator", routeClass: "analysis", requestAllowFallback: true },
      policy,
      registry
    );

    if ("ok" in resolved && resolved.ok === false) throw new Error("route should resolve");
    expect(resolved.allowFallback).toBe(true);
    expect(resolved.fallbackAlias).toBe("fake-fallback");
  });

  it("maxCostTier is enforced (T-R4)", () => {
    const registry = {
      version: 1,
      defaultRouteMap: {
        utility: "costly",
        default: "costly",
        analysis: "costly",
        coding: "costly",
        review: "disabled",
        fallback: "fake-fallback",
        mock: "fake-default"
      },
      models: [
        {
          id: "costly",
          provider: "fake",
          model: "costly",
          enabled: true,
          supportsStructured: true,
          relativeCostTier: 5,
          qualityTier: 1,
          latencyTier: 1
        },
        {
          id: "fake-fallback",
          provider: "fake",
          model: "fake-fallback",
          enabled: true,
          supportsStructured: true,
          relativeCostTier: 0,
          qualityTier: 0,
          latencyTier: 0
        },
        {
          id: "fake-default",
          provider: "fake",
          model: "fake-default",
          enabled: true,
          supportsStructured: true,
          relativeCostTier: 0,
          qualityTier: 0,
          latencyTier: 0
        }
      ]
    };

    const policy = {
      version: 1,
      routes: {
        utility: { enabled: true, allowFallback: true, maxCostTier: 0 },
        default: { enabled: true, allowFallback: true, maxCostTier: 1 },
        analysis: { enabled: true, allowFallback: true, maxCostTier: 1 },
        coding: { enabled: true, allowFallback: true, maxCostTier: 1 },
        review: { enabled: false, allowFallback: false },
        fallback: { enabled: true, allowFallback: false },
        mock: { enabled: true, allowFallback: false }
      }
    };

    const resolved = resolveRoute(
      { callerClass: "operator", routeClass: "default", requestAllowFallback: true },
      policy,
      registry
    );

    expect(resolved).toMatchObject({ ok: false, code: "LLM_ROUTE_DISABLED" });
  });
});
