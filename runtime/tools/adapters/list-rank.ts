import { canonicalStringify, sha256 } from '../../../control-plane/finance/determinism.ts';

export interface RankedSource {
  source: string;
  category: string;
  credibility: number;
  coverage: number;
  domain_type: string;
  score: number;
  identity: string;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeNames(names: string[]): string[] {
  return names
    .map((entry) => normalizeName(entry))
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

export function clusterDuplicates(input: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const clusters = new Map<string, Record<string, unknown>>();

  for (const entity of input) {
    const source = typeof entity.source === 'string' ? entity.source : '';
    const key = normalizeName(source);
    if (key.length === 0) {
      continue;
    }

    const current = clusters.get(key);
    if (!current) {
      clusters.set(key, { ...entity });
      continue;
    }

    clusters.set(key, {
      ...current,
      ...entity,
      source: source.length > 0 ? source : current.source
    });
  }

  return [...clusters.values()].sort((left, right) => {
    const leftSource = String(left.source ?? '');
    const rightSource = String(right.source ?? '');
    return leftSource.localeCompare(rightSource);
  });
}

export function dedupeEntities(input: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return clusterDuplicates(input);
}

function boundedScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Math.round(value * 100) / 100;
}

export function rankSources(input: Array<Record<string, unknown>>): RankedSource[] {
  return dedupeEntities(input)
    .map((entry) => {
      const source = String(entry.source ?? '').trim();
      const category = String(entry.category ?? 'unknown').trim();
      const domainType = String(entry.domain_type ?? 'unknown').trim();
      const credibility = boundedScore(typeof entry.credibility === 'number' ? entry.credibility : 0);
      const coverage = boundedScore(typeof entry.coverage === 'number' ? entry.coverage : 0);
      const score = Math.round(((credibility * 0.6) + (coverage * 0.4)) * 100) / 100;
      const identity = sha256(canonicalStringify({ source: normalizeName(source), category, domainType }));

      return {
        source,
        category,
        credibility,
        coverage,
        domain_type: domainType,
        score,
        identity
      };
    })
    .sort((left, right) => {
      const scoreCompare = right.score - left.score;
      if (scoreCompare !== 0) {
        return scoreCompare;
      }
      const credibilityCompare = right.credibility - left.credibility;
      if (credibilityCompare !== 0) {
        return credibilityCompare;
      }
      return left.source.localeCompare(right.source);
    });
}

export function listRank(input: {
  entities: Array<Record<string, unknown>>;
}): { ranked: RankedSource[] } {
  return {
    ranked: rankSources(input.entities)
  };
}
