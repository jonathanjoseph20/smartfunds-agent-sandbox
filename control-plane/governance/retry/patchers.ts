const FENCE = '```';
const EVIDENCE_OPEN = '```evidence';
const VALID_TIER_LINE = /^tier-[0-3]$/i;
const TIER_PREFIX_LINE = /^tier-/i;

type Tier = 0 | 1 | 2 | 3;

function normalize(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function splitLines(text: string): string[] {
  return normalize(text).split('\n');
}

function normalizePatched(text: string): string {
  return normalize(text).trimEnd();
}

function collectUnfencedTierDiagnostics(lines: string[]): {
  validTierLineIndices: number[];
  unsupportedTierLineIndices: number[];
} {
  const validTierLineIndices: number[] = [];
  const unsupportedTierLineIndices: number[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith(FENCE)) {
      if (!inFence) {
        inFence = true;
      } else if (trimmed === FENCE) {
        inFence = false;
      }
      continue;
    }

    if (inFence || !trimmed) {
      continue;
    }

    if (VALID_TIER_LINE.test(trimmed)) {
      validTierLineIndices.push(index);
      continue;
    }

    if (TIER_PREFIX_LINE.test(trimmed)) {
      unsupportedTierLineIndices.push(index);
    }
  }

  return { validTierLineIndices, unsupportedTierLineIndices };
}

function addTier3AtTop(lines: string[]): string {
  const withoutLeadingBlank = [...lines];
  while (withoutLeadingBlank.length > 0 && withoutLeadingBlank[0].trim() === '') {
    withoutLeadingBlank.shift();
  }
  if (withoutLeadingBlank.length === 0) {
    return 'tier-3';
  }
  return `tier-3\n\n${withoutLeadingBlank.join('\n')}`;
}

export function applyMissingTierDeclaration(bodyText: string): {
  nextBody: string;
  patchApplied: 'ADD_TIER_DECLARATION' | null;
} {
  const original = normalizePatched(bodyText);
  const lines = splitLines(bodyText);
  const { validTierLineIndices, unsupportedTierLineIndices } = collectUnfencedTierDiagnostics(lines);

  if (unsupportedTierLineIndices.length > 0) {
    return { nextBody: original, patchApplied: null };
  }

  if (validTierLineIndices.length === 1) {
    return { nextBody: original, patchApplied: null };
  }

  if (validTierLineIndices.length === 0) {
    const patched = normalizePatched(addTier3AtTop(lines));
    return {
      nextBody: patched,
      patchApplied: patched === original ? null : 'ADD_TIER_DECLARATION'
    };
  }

  const removed = lines.filter((_, index) => !validTierLineIndices.includes(index));
  const patched = normalizePatched(addTier3AtTop(removed));
  return {
    nextBody: patched,
    patchApplied: patched === original ? null : 'ADD_TIER_DECLARATION'
  };
}

function findEvidenceBlock(lines: string[]): { start: number; end: number } | null {
  let found: { start: number; end: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim().toLowerCase() !== EVIDENCE_OPEN) {
      continue;
    }
    if (found) {
      return null;
    }
    let end: number | null = null;
    for (let closing = index + 1; closing < lines.length; closing += 1) {
      if (lines[closing].trim() === FENCE) {
        end = closing;
        break;
      }
    }
    if (end === null) {
      return null;
    }
    found = { start: index, end };
  }

  return found;
}

function hasRiskTierField(lines: string[]): boolean {
  return lines.some((line) => {
    const separator = line.indexOf(':');
    if (separator < 0) {
      return false;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    return key === 'Risk Tier' && value.length > 0;
  });
}

export function applyMissingEvidenceRiskTier(bodyText: string, tier: Tier): {
  nextBody: string;
  patchApplied: 'ADD_EVIDENCE_RISK_TIER' | null;
} {
  const original = normalizePatched(bodyText);
  const lines = splitLines(bodyText);
  const evidence = findEvidenceBlock(lines);

  if (!evidence) {
    const block = `\`\`\`evidence\nRisk Tier: ${tier}\n\`\`\``;
    const patched = original.length > 0 ? `${original}\n\n${block}` : block;
    return {
      nextBody: normalizePatched(patched),
      patchApplied: normalizePatched(patched) === original ? null : 'ADD_EVIDENCE_RISK_TIER'
    };
  }

  const inside = lines.slice(evidence.start + 1, evidence.end);
  if (hasRiskTierField(inside)) {
    return { nextBody: original, patchApplied: null };
  }

  const patchedLines = [
    ...lines.slice(0, evidence.start + 1),
    `Risk Tier: ${tier}`,
    ...inside,
    ...lines.slice(evidence.end)
  ];
  const patched = normalizePatched(patchedLines.join('\n'));

  return {
    nextBody: patched,
    patchApplied: patched === original ? null : 'ADD_EVIDENCE_RISK_TIER'
  };
}
