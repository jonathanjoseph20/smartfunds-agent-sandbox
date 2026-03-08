import { describe, expect, it } from "vitest";

import { normalizeWebSearchResults } from "../src/web/normalize.js";
import { normalizeTwitterSearchResults } from "../src/twitter/normalize.js";

describe("normalizers", () => {
  it("web normalizer dedupes and sorts stably", () => {
    const result = normalizeWebSearchResults([
      { title: "B", url: "https://example.com/b" },
      { title: "A", url: "https://example.com/a" },
      { title: "A2", url: "https://example.com/a#dup" }
    ], 10);

    expect(result).toEqual([
      { rank: 1, title: "A", url: "https://example.com/a" },
      { rank: 2, title: "B", url: "https://example.com/b" }
    ]);
  });

  it("twitter normalizer filters non-twitter urls", () => {
    const result = normalizeTwitterSearchResults([
      { url: "https://example.com/a", title: "Nope" },
      { url: "https://x.com/user/status/123", title: "Yes" }
    ], 10);

    expect(result).toEqual([
      {
        rank: 1,
        url: "https://x.com/user/status/123",
        title: "Yes",
        authorHint: "user"
      }
    ]);
  });
});
