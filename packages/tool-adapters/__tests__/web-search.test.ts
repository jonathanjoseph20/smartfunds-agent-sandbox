import { describe, expect, it } from "vitest";

import { searchWeb } from "../src/web/search.js";

const HTML = `
<html><body>
  <a href="https://example.com/z">Result Z</a>
  <a href="https://example.com/a">Result A</a>
  <a href="https://example.com/a#fragment">Result A Duplicate</a>
</body></html>
`;

describe("web search", () => {
  it("normalizes and ranks results deterministically", async () => {
    const result = await searchWeb(
      { query: "rwa tokenization", limit: 10, sourceClass: "general" },
      {
        fetchImpl: async () => ({
          status: 200,
          text: async () => HTML
        }) as Response
      }
    );

    expect(result).toEqual({
      query: "rwa tokenization",
      results: [
        { rank: 1, title: "Result A", url: "https://example.com/a" },
        { rank: 2, title: "Result Z", url: "https://example.com/z" }
      ]
    });
  });
});
