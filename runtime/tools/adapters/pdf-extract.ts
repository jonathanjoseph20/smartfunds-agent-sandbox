export interface PdfParser {
  parse(input: Uint8Array): Promise<{ title?: string; pages?: number; text?: string }>;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

async function defaultPdfParser(): Promise<PdfParser> {
  throw new Error('ERR_TOOL_PDF_UNAVAILABLE: provide pdfParser implementation');
}

export async function pdfExtract(input: {
  pdfContent?: Uint8Array;
  url?: string;
  fetchImpl?: typeof fetch;
  pdfParser?: PdfParser;
}): Promise<{ title: string; pages: number; text: string }> {
  const parser = input.pdfParser ?? await defaultPdfParser();
  let content = input.pdfContent;

  if (!content && input.url) {
    const fetchImpl = input.fetchImpl ?? fetch;
    const response = await fetchImpl(input.url, {
      method: 'GET',
      headers: {
        'user-agent': 'smartfunds-runtime-tools/1.0'
      }
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    content = bytes;
  }

  if (!content || content.length === 0) {
    throw new Error('ERR_TOOL_INPUT: pdf_extract pdfContent or url is required');
  }

  const parsed = await parser.parse(content);
  return {
    title: typeof parsed.title === 'string' ? normalizeWhitespace(parsed.title) : '',
    pages: typeof parsed.pages === 'number' && Number.isFinite(parsed.pages) ? Math.max(0, Math.trunc(parsed.pages)) : 0,
    text: normalizeWhitespace(typeof parsed.text === 'string' ? parsed.text : '')
  };
}
