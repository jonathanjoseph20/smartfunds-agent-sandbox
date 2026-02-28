import { REQUIRED_EVIDENCE_KEYS } from './types.ts';

export type EvidenceFileParseResult = {
  kv: Record<string, string>;
  requiredMissing: string[];
  unsupportedKeys: string[];
  formatErrors: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function sortRecordByKey(value: Record<string, string>): Record<string, string> {
  const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(sortedEntries) as Record<string, string>;
}

export function parseEvidenceFileContent(content: string): EvidenceFileParseResult {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const kv: Record<string, string> = {};
  const formatErrors: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().length === 0) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) {
      formatErrors.push(`INVALID_KV_LINE:${index + 1}`);
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      formatErrors.push(`INVALID_KV_LINE:${index + 1}`);
      continue;
    }

    if (Object.hasOwn(kv, key)) {
      formatErrors.push(`DUPLICATE_KEY:${key}`);
    }

    kv[key] = value;
  }

  const requiredMissing = REQUIRED_EVIDENCE_KEYS.filter((key) => !Object.hasOwn(kv, key));
  const unsupportedKeys = Object.keys(kv).filter((key) => !REQUIRED_EVIDENCE_KEYS.includes(key as (typeof REQUIRED_EVIDENCE_KEYS)[number]));

  return {
    kv: sortRecordByKey(kv),
    requiredMissing: sortedUnique(requiredMissing),
    unsupportedKeys: sortedUnique(unsupportedKeys),
    formatErrors: sortedUnique(formatErrors)
  };
}
