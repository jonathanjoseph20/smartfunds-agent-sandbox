import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadModelRegistry, resolveModelAlias } from "../src/registry.js";

describe("registry", () => {
  it("loads valid config (T-L1)", () => {
    const registry = loadModelRegistry("control-plane/llm/models.v1.json");
    expect("ok" in registry && registry.ok === false).toBe(false);
    if (!("ok" in registry && registry.ok === false)) {
      expect(resolveModelAlias(registry, "default")).toBe("google-flash-lite");
    }
  });

  it("fails deterministically for missing path (T-L2)", () => {
    const registry = loadModelRegistry("control-plane/llm/does-not-exist.json");
    expect(registry).toMatchObject({ ok: false, code: "LLM_MODEL_NOT_FOUND" });
  });

  it("fails deterministically for disabled alias route (T-L3)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smartfunds-llm-registry-"));
    const registryPath = path.join(tmpDir, "models.v1.json");

    fs.writeFileSync(
      registryPath,
      JSON.stringify({
        version: 1,
        defaultRouteMap: {
          utility: "fake-default",
          default: "disabled",
          analysis: "fake-default",
          coding: "fake-default",
          review: "disabled",
          fallback: "fake-fallback",
          mock: "fake-default"
        },
        models: [
          {
            id: "fake-default",
            provider: "fake",
            model: "fake-default",
            enabled: true,
            supportsStructured: true,
            relativeCostTier: 0,
            qualityTier: 0,
            latencyTier: 0
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
          }
        ]
      })
    );

    const registry = loadModelRegistry(registryPath);
    if ("ok" in registry && registry.ok === false) {
      throw new Error("registry should load");
    }

    const alias = resolveModelAlias(registry, "default");
    expect(alias).toMatchObject({ ok: false, code: "LLM_ROUTE_DISABLED" });
  });
});
