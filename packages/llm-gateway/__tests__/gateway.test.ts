import { describe, expect, it } from "vitest";
import { createLlmGateway } from "../src/gateway.js";
import { createFakeProvider } from "../src/providers/fake.adapter.js";
import type { LlmProviderAdapter, ProviderStructuredRequest, ProviderTextRequest } from "../src/providers/base.js";
import { FakeAuditStore } from "../src/testing/fakeDb.js";
import { baseTextRequest } from "../src/testing/fixtures.js";

function fixedNow(): Date {
  return new Date("2026-01-01T00:00:00.000Z");
}

function testPolicy() {
  return {
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
}

describe("gateway", () => {
  it("text success path (T-G1)", async () => {
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

    const gateway = createLlmGateway({
      registry,
      routePolicy: testPolicy(),
      providers: { fake: createFakeProvider({ textResponse: "ok-text" }) },
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-1"
    });

    const result = await gateway.generateText(baseTextRequest());
    expect(result).toMatchObject({ ok: true, text: "ok-text", fallbackUsed: false, requestId: "req-1" });
  });

  it("fallback used on primary provider failure (T-G2)", async () => {
    const registry = {
      version: 1,
      defaultRouteMap: {
        utility: "primary-model",
        default: "primary-model",
        analysis: "primary-model",
        coding: "primary-model",
        review: "disabled",
        fallback: "fallback-model",
        mock: "primary-model"
      },
      models: [
        { id: "primary-model", provider: "primary", model: "primary-model", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 },
        { id: "fallback-model", provider: "fake", model: "fallback-model", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 }
      ]
    };

    const failingProvider: LlmProviderAdapter = {
      providerId: "primary",
      async generateText(_request: ProviderTextRequest) {
        throw new Error("primary failed");
      },
      async generateStructured(_request: ProviderStructuredRequest) {
        throw new Error("primary failed");
      }
    };

    const gateway = createLlmGateway({
      registry,
      routePolicy: testPolicy(),
      providers: {
        primary: failingProvider,
        fake: createFakeProvider({ textResponse: "fallback-text" })
      },
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-2"
    });

    const result = await gateway.generateText(baseTextRequest());
    expect(result).toMatchObject({ ok: true, text: "fallback-text", fallbackUsed: true });
  });

  it("provider disabled path (T-G3)", async () => {
    const registry = {
      version: 1,
      defaultRouteMap: {
        utility: "google-flash-lite",
        default: "google-flash-lite",
        analysis: "google-flash-lite",
        coding: "google-flash-lite",
        review: "disabled",
        fallback: "google-flash-lite",
        mock: "google-flash-lite"
      },
      models: [
        { id: "google-flash-lite", provider: "google", model: "gemini-2.5-flash-lite", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 }
      ]
    };

    const gateway = createLlmGateway({
      registry,
      routePolicy: testPolicy(),
      providers: {},
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-3"
    });

    const result = await gateway.generateText(baseTextRequest({ allowFallback: false }));
    expect(result).toMatchObject({ ok: false, code: "LLM_PROVIDER_DISABLED" });
  });

  it("audit write failure returns LLM_AUDIT_WRITE_FAILED (T-G4)", async () => {
    const auditStore = new FakeAuditStore();
    auditStore.setWriteFailure(true);

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

    const gateway = createLlmGateway({
      registry,
      routePolicy: testPolicy(),
      providers: { fake: createFakeProvider({ textResponse: "ok" }) },
      auditStore,
      now: fixedNow,
      requestIdFactory: () => "req-4"
    });

    const result = await gateway.generateText(baseTextRequest());
    expect(result).toMatchObject({ ok: false, code: "LLM_AUDIT_WRITE_FAILED" });
  });

  it("normalized errors only, no provider exception leakage (T-G5)", async () => {
    const throwingProvider: LlmProviderAdapter = {
      providerId: "fake",
      async generateText(_request: ProviderTextRequest) {
        throw new Error("raw provider explosion");
      },
      async generateStructured(_request: ProviderStructuredRequest) {
        throw new Error("raw provider explosion");
      }
    };

    const gateway = createLlmGateway({
      registry: {
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
      },
      routePolicy: testPolicy(),
      providers: { fake: throwingProvider },
      auditStore: new FakeAuditStore(),
      now: fixedNow,
      requestIdFactory: () => "req-5"
    });

    const result = await gateway.generateText(baseTextRequest({ allowFallback: false }));
    expect(result).toMatchObject({ ok: false, code: "LLM_PROVIDER_ERROR" });
    if (result.ok === false) {
      expect(result.message).not.toContain("raw provider explosion");
      expect(result.details).toBeDefined();
    }
  });
});
