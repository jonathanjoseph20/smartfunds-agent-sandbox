import { REQUIRED_EVIDENCE_KEYS, type ParsedEvidence, type TierLabel } from './types.ts';

const TIER_LABELS: TierLabel[] = ['tier-0', 'tier-1', 'tier-2', 'tier-3'];
const OPEN_FENCE = '```evidence';
const CLOSE_FENCE = '```';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function normalizeLines(body: string): string[] {
  return body.replace(/\r\n?/g, '\n').split('\n');
}

function sortRecordByKey(value: Record<string, string>): Record<string, string> {
  const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(sortedEntries) as Record<string, string>;
}

function findTierLine(lines: string[]): { tierLine: TierLabel | null; formatErrors: string[] } {
  const formatErrors: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if ((TIER_LABELS as string[]).includes(trimmed)) {
      return { tierLine: trimmed as TierLabel, formatErrors };
    }

    if (trimmed.startsWith('tier-')) {
      formatErrors.push(`INVALID_TIER_LABEL:${trimmed}`);
    }

    return { tierLine: null, formatErrors };
  }

  return { tierLine: null, formatErrors };
}

function findEvidenceBounds(lines: string[]): { start: number | null; end: number | null; formatErrors: string[] } {
  const start = lines.findIndex((line) => line === OPEN_FENCE);
  if (start < 0) {
    return { start: null, end: null, formatErrors: [] };
  }

  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] === CLOSE_FENCE) {
      return {
        start: start + 1,
        end: index + 1,
        formatErrors: []
      };
    }
  }

  return {
    start: null,
    end: null,
    formatErrors: ['UNCLOSED_EVIDENCE_BLOCK']
  };
}

export function parsePrBodyForGovernance(body: string): ParsedEvidence {
  const lines = normalizeLines(body);
  const { tierLine, formatErrors: tierFormatErrors } = findTierLine(lines);
  const bounds = findEvidenceBounds(lines);

  const formatErrors = [...tierFormatErrors, ...bounds.formatErrors];
  const kv: Record<string, string> = {};

  if (bounds.start !== null && bounds.end !== null) {
    for (let index = bounds.start; index < bounds.end - 1; index += 1) {
      const raw = lines[index];
      if (raw.trim().length === 0) {
        continue;
      }

      const separatorIndex = raw.indexOf(':');
      if (separatorIndex < 0) {
        formatErrors.push(`INVALID_KV_LINE:${index + 1}`);
        continue;
      }

      const key = raw.slice(0, separatorIndex).trim();
      const value = raw.slice(separatorIndex + 1).trim();
      if (!key || !value) {
        formatErrors.push(`INVALID_KV_LINE:${index + 1}`);
        continue;
      }

      if (Object.hasOwn(kv, key)) {
        formatErrors.push(`DUPLICATE_KEY:${key}`);
      }
      kv[key] = value;
    }
  }

  const requiredMissing = REQUIRED_EVIDENCE_KEYS.filter((key) => !Object.hasOwn(kv, key));
  const unsupportedKeys = Object.keys(kv).filter((key) => !REQUIRED_EVIDENCE_KEYS.includes(key as (typeof REQUIRED_EVIDENCE_KEYS)[number]));

  return {
    tierLine,
    evidenceFound: bounds.start !== null && bounds.end !== null,
    evidenceStartLine: bounds.start,
    evidenceEndLine: bounds.end,
    kv: sortRecordByKey(kv),
    requiredMissing: sortedUnique(requiredMissing),
    unsupportedKeys: sortedUnique(unsupportedKeys),
    formatErrors: sortedUnique(formatErrors)
  };
}
