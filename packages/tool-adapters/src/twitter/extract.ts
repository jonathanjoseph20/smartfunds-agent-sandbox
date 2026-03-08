type TwitterCandidate = {
  url: string;
  title?: string;
  snippet?: string;
};

export function extractAuthorHint(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    const parts = path.split("/").filter((part) => part.length > 0);
    const handle = parts[0];
    if (!handle || handle.toLowerCase() === "i" || handle.toLowerCase() === "search") {
      return undefined;
    }
    return handle;
  } catch {
    return undefined;
  }
}

export function toTwitterCandidate(input: TwitterCandidate): TwitterCandidate {
  return {
    url: input.url,
    ...(input.title ? { title: input.title } : {}),
    ...(input.snippet ? { snippet: input.snippet } : {})
  };
}
