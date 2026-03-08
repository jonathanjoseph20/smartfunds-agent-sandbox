import { describe, expect, it } from "vitest";

import { buildTwitterSearchQuery, searchTwitter } from "../src/twitter/search.js";

describe("twitter search", () => {
  it("builds constrained search query", () => {
    expect(buildTwitterSearchQuery("rwa tokenization")).toBe("site:x.com OR site:twitter.com rwa tokenization");
  });

  it("returns normalized twitter-only results", async () => {
    const html = `
      <a href="https://x.com/alice/status/1">Alice Post</a>
      <a href="https://example.com/not-twitter">Other</a>
      <a href="https://twitter.com/bob/status/2">Bob Post</a>
    `;

    const result = await searchTwitter(
      { query: "rwa", limit: 10 },
      {
        fetchImpl: async () => ({
          status: 200,
          text: async () => html
        }) as Response
      }
    );

    expect(result).toEqual({
      query: "rwa",
      results: [
        {
          rank: 1,
          url: "https://twitter.com/bob/status/2",
          title: "Bob Post",
          authorHint: "bob"
        },
        {
          rank: 2,
          url: "https://x.com/alice/status/1",
          title: "Alice Post",
          authorHint: "alice"
        }
      ]
    });
  });
});
