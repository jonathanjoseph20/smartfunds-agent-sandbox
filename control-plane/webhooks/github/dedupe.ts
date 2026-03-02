const seenNormalizedHashes = new Set<string>();

export function recordNormalizedHash(normalizedHash: string): boolean {
  if (seenNormalizedHashes.has(normalizedHash)) {
    return false;
  }

  seenNormalizedHashes.add(normalizedHash);
  return true;
}

export function resetGithubWebhookDedupeForTests(): void {
  seenNormalizedHashes.clear();
}
