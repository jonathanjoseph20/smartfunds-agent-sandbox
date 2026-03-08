export interface BrowserFetchRenderer {
  fetch(input: { url: string; timeoutMs: number }): Promise<{
    finalUrl: string;
    status?: number;
    html: string;
    title?: string;
    description?: string;
  }>;
}

function normalizeHtml(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

class PlaywrightRenderer implements BrowserFetchRenderer {
  async fetch(input: { url: string; timeoutMs: number }): Promise<{ finalUrl: string; status?: number; html: string; title?: string; description?: string }> {
    const mod = await import('playwright').catch(() => null);
    if (!mod?.chromium) {
      throw new Error('ERR_TOOL_BROWSER_UNAVAILABLE: playwright is not installed');
    }

    const browser = await mod.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const response = await page.goto(input.url, {
        waitUntil: 'domcontentloaded',
        timeout: input.timeoutMs
      });

      const html = await page.content();
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').first().getAttribute('content').catch(() => null);

      return {
        finalUrl: page.url(),
        status: response?.status(),
        html,
        title,
        description: description ?? undefined
      };
    } finally {
      await browser.close();
    }
  }
}

export async function browserFetch(input: {
  url: string;
  timeoutMs?: number;
  renderer?: BrowserFetchRenderer;
}): Promise<Record<string, unknown>> {
  const renderer = input.renderer ?? new PlaywrightRenderer();
  const timeoutMs = typeof input.timeoutMs === 'number' ? Math.max(1, Math.trunc(input.timeoutMs)) : 15000;

  const rendered = await renderer.fetch({
    url: input.url,
    timeoutMs
  });

  return {
    finalUrl: rendered.finalUrl,
    status: typeof rendered.status === 'number' ? rendered.status : 0,
    html: normalizeHtml(rendered.html),
    metadata: {
      title: typeof rendered.title === 'string' ? rendered.title.trim() : '',
      description: typeof rendered.description === 'string' ? rendered.description.trim() : ''
    }
  };
}
