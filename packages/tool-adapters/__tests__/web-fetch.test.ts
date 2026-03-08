import { describe, expect, it } from "vitest";

import { fetchPage } from "../src/web/fetch.js";

describe("web fetch", () => {
  it("extracts title and normalized text", async () => {
    const html = "<html><head><title>Alpha</title></head><body><p>Hello <b>world</b>.</p></body></html>";

    const result = await fetchPage(
      { url: "https://example.com/page" },
      {
        fetchImpl: async () => ({
          status: 200,
          text: async () => html
        }) as Response
      }
    );

    expect(result).toEqual({
      url: "https://example.com/page",
      title: "Alpha",
      text: "Alpha Hello world .",
      statusCode: 200
    });
  });
});
