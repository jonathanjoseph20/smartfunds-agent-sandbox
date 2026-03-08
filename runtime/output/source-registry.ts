function toDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export interface SourceEntry {
  url: string;
  domain: string;
  firstSeenStep: string;
}

export class SourceRegistry {
  private readonly byUrl = new Map<string, SourceEntry>();

  add(input: { url: string; firstSeenStep: string }): void {
    const url = input.url.trim();
    if (url.length === 0) {
      return;
    }

    const next: SourceEntry = {
      url,
      domain: toDomain(url),
      firstSeenStep: input.firstSeenStep
    };

    const previous = this.byUrl.get(url);
    if (!previous) {
      this.byUrl.set(url, next);
      return;
    }

    if (next.firstSeenStep.localeCompare(previous.firstSeenStep) < 0) {
      this.byUrl.set(url, next);
    }
  }

  list(): SourceEntry[] {
    return [...this.byUrl.values()].sort((left, right) => {
      const urlCompare = left.url.localeCompare(right.url);
      if (urlCompare !== 0) {
        return urlCompare;
      }
      const domainCompare = left.domain.localeCompare(right.domain);
      if (domainCompare !== 0) {
        return domainCompare;
      }
      return left.firstSeenStep.localeCompare(right.firstSeenStep);
    });
  }
}
