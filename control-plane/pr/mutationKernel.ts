import { EVIDENCE_FIELDS, OPTIONAL_EVIDENCE_FIELDS } from '../governance/diagnostics.ts';
import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export interface PRMutationInput {
  currentBody: string;
  currentLabels: string[];
  desiredTier?: string;
  evidenceFields?: Record<string, string>;
  retryAttempt?: number | null;
  allowedLabelMutations?: string[];
}

export interface PRMutationResult {
  newBody: string;
  newLabels: string[];
  bodyChanged: boolean;
  labelsChanged: boolean;
  requiresMetadataRefresh: boolean;
  deterministicHash: string;
}

type EvidenceBlockRange = { start: number; end: number };

const REQUIRED_FIELD_ORDER = [...EVIDENCE_FIELDS];
const OPTIONAL_FIELD_ORDER = [...OPTIONAL_EVIDENCE_FIELDS];
const TIER_LABELS = ['tier-0', 'tier-1', 'tier-2', 'tier-3'] as const;

function normalizeLines(value: string): string[] {
  return value.replace(/\r\n?/g, '\n').split('\n');
}

function normalizeTierLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.trim().toLowerCase().match(/^tier-([0-3])$/);
  if (!match) {
    return null;
  }

  return `tier-${match[1]}`;
}

function tierValue(tierLabel: string): string {
  const match = tierLabel.match(/^tier-([0-3])$/);
  if (!match) {
    return '0';
  }
  return match[1];
}

function isFenceLine(line: string): boolean {
  return line.trim().startsWith('```');
}

function findEvidenceBlockRanges(lines: string[]): EvidenceBlockRange[] {
  const ranges: EvidenceBlockRange[] = [];

  let index = 0;
  while (index < lines.length) {
    if (!/^```\s*evidence\s*$/i.test(lines[index].trim())) {
      index += 1;
      continue;
    }

    const start = index;
    let end = lines.length - 1;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^```\s*$/.test(lines[cursor].trim())) {
        end = cursor;
        break;
      }
    }

    ranges.push({ start, end });
    index = end + 1;
  }

  return ranges;
}

function keySortRank(key: string): [number, string] {
  const requiredIndex = REQUIRED_FIELD_ORDER.indexOf(key as (typeof REQUIRED_FIELD_ORDER)[number]);
  if (requiredIndex >= 0) {
    return [0, String(requiredIndex).padStart(4, '0')];
  }

  const optionalIndex = OPTIONAL_FIELD_ORDER.indexOf(key as (typeof OPTIONAL_FIELD_ORDER)[number]);
  if (optionalIndex >= 0) {
    return [1, String(optionalIndex).padStart(4, '0')];
  }

  return [2, key.toLowerCase()];
}

function canonicalizeEvidenceKey(key: string): string {
  const trimmed = key.trim();
  const lowered = trimmed.toLowerCase();

  for (const field of REQUIRED_FIELD_ORDER) {
    if (lowered === field.toLowerCase()) {
      return field;
    }
  }

  for (const field of OPTIONAL_FIELD_ORDER) {
    if (lowered === field.toLowerCase()) {
      return field;
    }
  }

  if (lowered.replace(/[\s_-]/g, '') === 'retryattempt') {
    return 'retry-attempt';
  }

  return trimmed;
}

function parseEvidenceLines(lines: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      continue;
    }

    const key = canonicalizeEvidenceKey(trimmed.slice(0, separator));
    const value = trimmed.slice(separator + 1).trim();
    if (!key || !value) {
      continue;
    }

    parsed[key] = value;
  }

  return parsed;
}

function buildCanonicalEvidence(args: {
  currentBody: string;
  resolvedTier: string;
  evidenceFields?: Record<string, string>;
  retryAttempt?: number | null;
}): Record<string, string> {
  const lines = normalizeLines(args.currentBody);
  const ranges = findEvidenceBlockRanges(lines);

  const evidence: Record<string, string> = {
    'Risk Tier': tierValue(args.resolvedTier),
    'Justification': 'N/A',
    'Affected Paths': 'N/A',
    'Tests Added': 'N/A',
    'Determinism Statement': 'N/A'
  };

  for (const range of ranges) {
    const parsed = parseEvidenceLines(lines.slice(range.start + 1, range.end));
    for (const [key, value] of Object.entries(parsed)) {
      evidence[key] = value;
    }
  }

  if (args.evidenceFields) {
    const entries = Object.entries(args.evidenceFields)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [canonicalizeEvidenceKey(key), value.trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0)
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [key, value] of entries) {
      evidence[key] = value;
    }
  }

  evidence['Risk Tier'] = tierValue(args.resolvedTier);

  if (args.retryAttempt === null) {
    delete evidence['retry-attempt'];
  } else if (typeof args.retryAttempt === 'number') {
    evidence['retry-attempt'] = String(args.retryAttempt);
  }

  const keys = Object.keys(evidence)
    .filter((key) => evidence[key].trim().length > 0)
    .sort((left, right) => {
      const [leftRank, leftSort] = keySortRank(left);
      const [rightRank, rightSort] = keySortRank(right);
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return leftSort.localeCompare(rightSort);
    });

  const sortedEvidence: Record<string, string> = {};
  for (const key of keys) {
    sortedEvidence[key] = evidence[key].trim();
  }

  return sortedEvidence;
}

function resolveTierLine(args: { currentBody: string; desiredTier?: string }): string {
  const lines = normalizeLines(args.currentBody);

  const discovered: number[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (isFenceLine(trimmed)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const match = trimmed.toLowerCase().match(/^tier-([0-3])$/);
    if (!match) {
      continue;
    }

    discovered.push(Number.parseInt(match[1], 10));
  }

  const desired = normalizeTierLabel(args.desiredTier);
  if (desired) {
    return desired;
  }

  if (discovered.length > 0) {
    return `tier-${Math.max(...discovered)}`;
  }

  const evidence = buildCanonicalEvidence({
    currentBody: args.currentBody,
    resolvedTier: 'tier-0'
  });
  const evidenceTier = evidence['Risk Tier'];
  if (/^[0-3]$/.test(evidenceTier)) {
    return `tier-${evidenceTier}`;
  }

  return 'tier-0';
}

function stripTierAndEvidenceBlocks(currentBody: string): string {
  const lines = normalizeLines(currentBody);
  const ranges = findEvidenceBlockRanges(lines);

  const inEvidenceRange = new Array<boolean>(lines.length).fill(false);
  for (const range of ranges) {
    for (let index = range.start; index <= range.end; index += 1) {
      inEvidenceRange[index] = true;
    }
  }

  const kept: string[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (inEvidenceRange[index]) {
      continue;
    }

    const line = lines[index];
    const trimmed = line.trim();

    if (isFenceLine(trimmed)) {
      inFence = !inFence;
      kept.push(line);
      continue;
    }

    if (!inFence && /^tier-([0-3])$/i.test(trimmed)) {
      continue;
    }

    kept.push(line);
  }

  while (kept.length > 0 && kept[0].trim().length === 0) {
    kept.shift();
  }
  while (kept.length > 0 && kept[kept.length - 1].trim().length === 0) {
    kept.pop();
  }

  return kept.join('\n');
}

function buildCanonicalBody(args: {
  currentBody: string;
  desiredTier?: string;
  evidenceFields?: Record<string, string>;
  retryAttempt?: number | null;
}): string {
  const resolvedTier = resolveTierLine({
    currentBody: args.currentBody,
    desiredTier: args.desiredTier
  });

  const evidence = buildCanonicalEvidence({
    currentBody: args.currentBody,
    resolvedTier,
    evidenceFields: args.evidenceFields,
    retryAttempt: args.retryAttempt
  });

  const evidenceLines = Object.entries(evidence).map(([key, value]) => `${key}: ${value}`);
  const remainder = stripTierAndEvidenceBlocks(args.currentBody);

  const rebuilt: string[] = [
    resolvedTier,
    '',
    '```evidence',
    ...evidenceLines,
    '```'
  ];

  if (remainder.length > 0) {
    rebuilt.push('', remainder);
  }

  return rebuilt.join('\n');
}

function toUniqueSortedLabels(labels: string[]): string[] {
  return Array.from(new Set(labels.map((label) => label.trim()).filter((label) => label.length > 0))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function mutateLabels(args: {
  currentLabels: string[];
  desiredTier?: string;
  allowedLabelMutations?: string[];
}): string[] {
  const current = toUniqueSortedLabels(args.currentLabels);
  const next = new Set(current);
  const allowed = new Set((args.allowedLabelMutations ?? []).map((label) => label.trim()).filter((label) => label.length > 0));
  const desiredTier = normalizeTierLabel(args.desiredTier);

  if (!desiredTier) {
    return toUniqueSortedLabels([...next]);
  }

  for (const tierLabel of TIER_LABELS) {
    if (tierLabel === desiredTier) {
      continue;
    }
    if (next.has(tierLabel) && allowed.has(tierLabel)) {
      next.delete(tierLabel);
    }
  }

  if (allowed.has(desiredTier)) {
    next.add(desiredTier);
  }

  return toUniqueSortedLabels([...next]);
}

export function mutationKernel(input: PRMutationInput): PRMutationResult {
  const canonicalBody = buildCanonicalBody({
    currentBody: input.currentBody,
    desiredTier: input.desiredTier,
    evidenceFields: input.evidenceFields,
    retryAttempt: input.retryAttempt
  });

  const nextLabels = mutateLabels({
    currentLabels: input.currentLabels,
    desiredTier: input.desiredTier,
    allowedLabelMutations: input.allowedLabelMutations
  });

  const normalizedCurrentBody = input.currentBody.replace(/\r\n?/g, '\n');
  const normalizedCurrentLabels = toUniqueSortedLabels(input.currentLabels);

  const bodyChanged = canonicalBody !== normalizedCurrentBody;
  const labelsChanged = canonicalStringify(nextLabels) !== canonicalStringify(normalizedCurrentLabels);
  const requiresMetadataRefresh = bodyChanged || labelsChanged;
  const deterministicHash = sha256(canonicalStringify({ body: canonicalBody, labels: nextLabels }));

  return {
    newBody: canonicalBody,
    newLabels: nextLabels,
    bodyChanged,
    labelsChanged,
    requiresMetadataRefresh,
    deterministicHash
  };
}
