export function normalizeUrl(input: string): string | null {
  try {
    const url = new URL(input);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isTwitterUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "x.com" || host === "www.x.com" || host === "twitter.com" || host === "www.twitter.com";
  } catch {
    return false;
  }
}
