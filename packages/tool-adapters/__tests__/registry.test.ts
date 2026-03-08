import { describe, expect, it } from "vitest";

import { resolveTool, toolRegistry } from "../src/registry.js";

describe("tool registry", () => {
  it("resolves all built-in adapters", () => {
    expect(resolveTool("web_search")).toBe(toolRegistry.web_search);
    expect(resolveTool("web_fetch")).toBe(toolRegistry.web_fetch);
    expect(resolveTool("twitter_search")).toBe(toolRegistry.twitter_search);
  });

  it("throws deterministic error for unknown tool", () => {
    expect(() => resolveTool("unknown" as "web_search")).toThrow("ERR_TOOL_ADAPTER_NOT_FOUND: unknown");
  });
});
