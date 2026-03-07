import { describe, expect, it } from "vitest";
import { assertCallerRouteAccess } from "../src/access.js";

describe("access", () => {
  it("caller access policy enforced (T-A1)", () => {
    const denied = assertCallerRouteAccess("internal_service", "review");
    expect(denied?.code).toBe("LLM_ROUTE_NOT_ALLOWED");

    const allowed = assertCallerRouteAccess("operator", "review");
    expect(allowed).toBeNull();
  });

  it("agent_runtime and workflow_node blocked from coding/review (T-A2)", () => {
    expect(assertCallerRouteAccess("agent_runtime", "coding")?.code).toBe("LLM_ROUTE_NOT_ALLOWED");
    expect(assertCallerRouteAccess("agent_runtime", "review")?.code).toBe("LLM_ROUTE_NOT_ALLOWED");
    expect(assertCallerRouteAccess("workflow_node", "coding")?.code).toBe("LLM_ROUTE_NOT_ALLOWED");
    expect(assertCallerRouteAccess("workflow_node", "review")?.code).toBe("LLM_ROUTE_NOT_ALLOWED");
  });

  it("external_api restricted properly (T-A3)", () => {
    expect(assertCallerRouteAccess("external_api", "utility")).toBeNull();
    expect(assertCallerRouteAccess("external_api", "default")).toBeNull();
    expect(assertCallerRouteAccess("external_api", "fallback")).toBeNull();
    expect(assertCallerRouteAccess("external_api", "analysis")?.code).toBe("LLM_ROUTE_NOT_ALLOWED");
    expect(assertCallerRouteAccess("external_api", "coding")?.code).toBe("LLM_ROUTE_NOT_ALLOWED");
    expect(assertCallerRouteAccess("external_api", "review")?.code).toBe("LLM_ROUTE_NOT_ALLOWED");
    expect(assertCallerRouteAccess("external_api", "mock")?.code).toBe("LLM_ROUTE_NOT_ALLOWED");
  });
});
