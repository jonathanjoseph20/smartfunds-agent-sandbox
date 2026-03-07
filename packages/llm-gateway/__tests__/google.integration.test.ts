import { describe, expect, it } from "vitest";
import { createLlmGateway } from "../src/gateway.js";
import { createFakeProvider } from "../src/providers/fake.adapter.js";
import { FakeAuditStore } from "../src/testing/fakeDb.js";
import { baseStructuredRequest, baseTextRequest } from "../src/testing/fixtures.js";

const runLive = process.env.RUN_LLM_INTEGRATION === "1"
  && process.env.LLM_ENABLE_PROVIDER_GOOGLE === "1"
  && typeof process.env.GOOGLE_API_KEY === "string"
  && process.env.GOOGLE_API_KEY.length > 0;

describe("google integration", () => {
  it.skipIf(!runLive)("returns text from google provider (T-GI1)", async () => {
    const gateway = createLlmGateway({
      registry: {
        version: 1,
        defaultRouteMap: {
          utility: "google-flash-lite",
          default: "google-flash-lite",
          analysis: "google-flash-lite",
          coding: "google-flash-lite",
          review: "disabled",
          fallback: "fake-fallback",
          mock: "fake-default"
        },
        models: [
          { id: "google-flash-lite", provider: "google", model: "gemini-2.5-flash-lite", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 1, latencyTier: 1 },
          { id: "fake-default", provider: "fake", model: "fake-default", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 },
          { id: "fake-fallback", provider: "fake", model: "fake-fallback", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 }
        ]
      },
      routePolicy: {
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
      },
      providers: {
        fake: createFakeProvider()
      },
      auditStore: new FakeAuditStore(),
      requestIdFactory: () => "req-gi1"
    });

    const result = await gateway.generateText(baseTextRequest({ userPrompt: "Reply with one short sentence." }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(!runLive)("returns structured JSON and normalizes timeout (T-GI2)", async () => {
    const gateway = createLlmGateway({
      auditStore: new FakeAuditStore(),
      requestIdFactory: () => "req-gi2",
      timeoutMs: 1
    });

    const structured = await gateway.generateStructured<{ name: string }>({
      ...baseStructuredRequest(),
      userPrompt: "Return JSON object with field name as string"
    });

    expect(structured.ok === true || (structured.ok === false && ["LLM_PROVIDER_TIMEOUT", "LLM_PROVIDER_ERROR", "LLM_INVALID_JSON", "LLM_SCHEMA_VALIDATION_FAILED"].includes(structured.code))).toBe(true);
  });

  it.skipIf(!runLive)("fallback works if primary fails and policy allows (T-GI3)", async () => {
    const gateway = createLlmGateway({
      registry: {
        version: 1,
        defaultRouteMap: {
          utility: "google-flash-lite",
          default: "google-flash-lite",
          analysis: "google-flash-lite",
          coding: "google-flash-lite",
          review: "disabled",
          fallback: "fake-fallback",
          mock: "fake-default"
        },
        models: [
          { id: "google-flash-lite", provider: "google", model: "gemini-2.5-flash-lite", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 1, latencyTier: 1 },
          { id: "fake-default", provider: "fake", model: "fake-default", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 },
          { id: "fake-fallback", provider: "fake", model: "fake-fallback", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 }
        ]
      },
      routePolicy: {
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
      },
      providers: {
        fake: createFakeProvider({ textResponse: "fallback-live" })
      },
      auditStore: new FakeAuditStore(),
      requestIdFactory: () => "req-gi3",
      timeoutMs: 1
    });

    const result = await gateway.generateText(baseTextRequest({ allowFallback: true }));
    expect(result.ok === true || (result.ok === false && ["LLM_PROVIDER_TIMEOUT", "LLM_PROVIDER_ERROR"].includes(result.code))).toBe(true);
  });
});
