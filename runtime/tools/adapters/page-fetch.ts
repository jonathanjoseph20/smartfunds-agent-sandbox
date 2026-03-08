function normalizeHtml(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

export async function pageFetch(input: {
  url: string;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(input.url, {
    method: 'GET',
    headers: {
      'user-agent': 'smartfunds-runtime-tools/1.0'
    }
  });

  const html = normalizeHtml(await response.text());
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    finalUrl: response.url || input.url,
    html
  };
}
