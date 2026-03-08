export function extractTitle(html: string): string | undefined {
  const matched = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!matched) {
    return undefined;
  }

  const cleaned = matched[1].replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}
