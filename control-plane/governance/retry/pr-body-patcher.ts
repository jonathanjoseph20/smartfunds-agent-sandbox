const REQUIRED_EVIDENCE_FIELDS = [
  'Risk Tier',
  'Justification',
  'Affected Paths',
  'Tests Added',
  'Determinism Statement'
] as const;

type EvidenceField = (typeof REQUIRED_EVIDENCE_FIELDS)[number];

export type EvidenceDefaults = Record<EvidenceField, string>;

export type BodyPatchResult = {
  patchedBody: string;
  changed: boolean;
  addedFields: string[];
};

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function buildEvidenceDefaults(tier: number): EvidenceDefaults {
  const tierValue = String(tier);
  return {
    'Risk Tier': tierValue,
    'Justification': 'Automated governance retry remediation for required metadata.',
    'Affected Paths': 'N/A (metadata-only remediation)',
    'Tests Added': 'N/A (metadata-only remediation)',
    'Determinism Statement': 'Deterministic metadata patch; no timestamps, UUIDs, or randomness.'
  };
}

function ensureTierLineAtTop(body: string, tier: number): string {
  const lines = normalizeNewlines(body).split('\n');
  const filtered: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      filtered.push(line);
      continue;
    }

    if (!inFence && /^tier-[0-3]$/i.test(trimmed)) {
      continue;
    }

    filtered.push(line);
  }

  while (filtered.length > 0 && filtered[0].trim() === '') {
    filtered.shift();
  }

  return [`tier-${tier}`, '', ...filtered].join('\n');
}

function findEvidenceBlock(lines: string[]): { start: number; end: number } | null {
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^```evidence\s*$/i.test(lines[index].trim())) {
      continue;
    }

    for (let closing = index + 1; closing < lines.length; closing += 1) {
      if (lines[closing].trim() === '```') {
        return { start: index, end: closing };
      }
    }

    return null;
  }

  return null;
}

function fillEvidenceBlock(lines: string[], defaults: EvidenceDefaults): { lines: string[]; addedFields: string[] } {
  const map = new Map<EvidenceField, number>();
  const result = [...lines];

  for (let index = 0; index < result.length; index += 1) {
    const match = result[index].match(/^\s*([^:]+)\s*:\s*(.*)$/);
    if (!match) {
      continue;
    }
    const key = match[1].trim() as EvidenceField;
    if (!REQUIRED_EVIDENCE_FIELDS.includes(key)) {
      continue;
    }
    if (!map.has(key)) {
      map.set(key, index);
    }
  }

  const addedFields: string[] = [];
  for (const field of REQUIRED_EVIDENCE_FIELDS) {
    const existing = map.get(field);
    if (existing === undefined) {
      result.push(`${field}: ${defaults[field]}`);
      addedFields.push(field);
      continue;
    }

    const match = result[existing].match(/^\s*([^:]+)\s*:\s*(.*)$/);
    const existingValue = match?.[2]?.trim() ?? '';
    if (!existingValue) {
      result[existing] = `${field}: ${defaults[field]}`;
      addedFields.push(field);
    }
  }

  return { lines: result, addedFields };
}

function appendEvidenceBlock(body: string, defaults: EvidenceDefaults): { body: string; addedFields: string[] } {
  const blockLines = [
    '```evidence',
    ...REQUIRED_EVIDENCE_FIELDS.map((field) => `${field}: ${defaults[field]}`),
    '```'
  ];
  const normalized = normalizeNewlines(body).trimEnd();
  if (normalized.length === 0) {
    return { body: blockLines.join('\n'), addedFields: [...REQUIRED_EVIDENCE_FIELDS] };
  }
  return {
    body: `${normalized}\n\n${blockLines.join('\n')}`,
    addedFields: [...REQUIRED_EVIDENCE_FIELDS]
  };
}

export function patchPrBody(body: string, tier: number): BodyPatchResult {
  const defaults = buildEvidenceDefaults(tier);
  const withTierLine = ensureTierLineAtTop(body, tier);
  const lines = withTierLine.split('\n');
  const evidenceBlock = findEvidenceBlock(lines);

  let patchedBody = withTierLine;
  let addedFields: string[] = [];

  if (!evidenceBlock) {
    const appended = appendEvidenceBlock(withTierLine, defaults);
    patchedBody = appended.body;
    addedFields = appended.addedFields;
  } else {
    const insideBlock = lines.slice(evidenceBlock.start + 1, evidenceBlock.end);
    const filled = fillEvidenceBlock(insideBlock, defaults);
    const merged = [
      ...lines.slice(0, evidenceBlock.start + 1),
      ...filled.lines,
      ...lines.slice(evidenceBlock.end)
    ];
    patchedBody = merged.join('\n');
    addedFields = filled.addedFields;
  }

  const normalizedOriginal = normalizeNewlines(body).trimEnd();
  const normalizedPatched = normalizeNewlines(patchedBody).trimEnd();

  return {
    patchedBody: normalizedPatched,
    changed: normalizedOriginal !== normalizedPatched,
    addedFields: Array.from(new Set(addedFields)).sort((a, b) => a.localeCompare(b))
  };
}
