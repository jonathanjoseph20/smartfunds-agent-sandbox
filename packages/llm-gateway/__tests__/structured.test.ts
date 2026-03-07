import { describe, expect, it } from "vitest";
import { createLlmGateway } from "../src/gateway.js";
import { createFakeProvider } from "../src/providers/fake.adapter.js";
import type { LlmProviderAdapter, ProviderStructuredRequest, ProviderStructuredResult, ProviderTextRequest, ProviderTextResult } from "../src/providers/base.js";
import { FakeAuditStore } from "../src/testing/fakeDb.js";
import { baseSchema, baseStructuredRequest } from "../src/testing/fixtures.js";

function fixedNow(): Date {
  return new Date("2026-01-02T00:00:00.000Z");
}

const registry = {
  version: 1,
  defaultRouteMap: {
    utility: "fake-default",
    default: "fake-default",
    analysis: "fake-default",
    coding: "fake-default",
    review: "disabled",
    fallback: "fake-fallback",
    mock: "fake-default"
  },
  models: [
    { id: "fake-default", provider: "fake", model: "fake-default", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 },
    { id: "fake-fallback", provider: "fake", model: "fake-fallback", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 }
  ]
};

const policy = {
  version: 1,
  routes: {
    utility: { enabled: true, allowFallback: true, maxCostTier: 1 },
    default: { enabled: true, allowFallback: true, maxCostTier: 1 },
    analysis: { enabled: true, allowFallback: true, maxCostTier: 1 },
    coding: { enabled: true, allowFallback: true, maxCostTier: 1, allowedCallerClasses: ["operator", "internal_service", "operator_tool"] },
    review: { enabled: false, allowFallback: false, allowedCallerClasses: ["operator", "operator_tool"] },
    fallback: { enabled: true, allowFallback: false },
    mock: { enabled: true, allowFallback: false }
  }
};

describe("structured", () => {
  it("structured success path (T-S1)", async () => {
    const gateway = createLlmGateway({
      registry,
      routePolicy: policy,
      providers: { fake: createFakeProvider({ rawStructuredText: JSON.stringify({ name: "Alice" }) }) },
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-s1"
    });

    const result = await gateway.generateStructured<{ name: string }>(baseStructuredRequest());
    expect(result).toMatchObject({ ok: true, value: { name: "Alice" } });
  });

  it("invalid JSON failure (T-S2)", async () => {
    const gateway = createLlmGateway({
      registry,
      routePolicy: policy,
      providers: { fake: createFakeProvider({ rawStructuredText: "not-json" }) },
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-s2"
    });

    const result = await gateway.generateStructured<{ name: string }>(baseStructuredRequest());
    expect(result).toMatchObject({ ok: false, code: "LLM_INVALID_JSON" });
  });

  it("schema validation failure (T-S3)", async () => {
    const gateway = createLlmGateway({
      registry,
      routePolicy: policy,
      providers: { fake: createFakeProvider({ rawStructuredText: JSON.stringify({ wrong: true }) }) },
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-s3"
    });

    const result = await gateway.generateStructured<{ name: string }>({
      ...baseStructuredRequest(),
      schema: baseSchema()
    });

    expect(result).toMatchObject({ ok: false, code: "LLM_SCHEMA_VALIDATION_FAILED" });
  });

  it("optional repair path works (T-S4)", async () => {
    let calls = 0;
    const flakyProvider: LlmProviderAdapter = {
      providerId: "fake",
      async generateText(_request: ProviderTextRequest): Promise<ProviderTextResult> {
        return { text: "unused", providerModel: "fake-default" };
      },
      async generateStructured(_request: ProviderStructuredRequest): Promise<ProviderStructuredResult> {
        calls += 1;
        if (calls === 1) {
          return { rawText: "{ invalid", providerModel: "fake-default" };
        }
        return { rawText: JSON.stringify({ name: "Repaired" }), providerModel: "fake-default" };
      }
    };

    const gateway = createLlmGateway({
      registry,
      routePolicy: policy,
      providers: { fake: flakyProvider },
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-s4"
    });

    const result = await gateway.generateStructured<{ name: string }>({
      ...baseStructuredRequest(),
      repairOnFailure: true
    });

    expect(result).toMatchObject({ ok: true, value: { name: "Repaired" } });
    expect(calls).toBe(2);
  });

  it("typed value returned on success (T-S5)", async () => {
    const gateway = createLlmGateway({
      registry,
      routePolicy: policy,
      providers: { fake: createFakeProvider({ rawStructuredText: JSON.stringify({ name: "Typed" }) }) },
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-s5"
    });

    const result = await gateway.generateStructured<{ name: string }>(baseStructuredRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value: { name: string } = result.value;
      expect(value.name).toBe("Typed");
    }
  });
});
