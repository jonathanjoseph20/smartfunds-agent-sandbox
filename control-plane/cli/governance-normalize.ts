import fs from 'node:fs';
import path from 'node:path';

import { EVIDENCE_FIELDS } from '../governance/diagnostics.ts';

const BACKTICK = String.fromCharCode(0o140);
const FENCE = BACKTICK.repeat(3);
const OPEN_FENCE = `${FENCE}evidence`;

const DEFAULT_BODY_FILE = '.pr-body.md';

const REQUIRED_FIELDS = [...EVIDENCE_FIELDS];

const PLACEHOLDER_VALUE = '<placeholder>';
const RISK_TIER_PLACEHOLDER = '<0|1|2|3>';
const DETERMINISM_DEFAULT = 'Deterministic; no randomness, no hidden mutation, sorted output.';

type NormalizeResult = {
  normalized: string;
  removedTierLines: number;
  insertedTierLine: boolean;
  hadEvidenceBlock: boolean;
};

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripTrailingWhitespace(value: string): string {
  return value.replace(/[ \t]+$/g, '');
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function isTierLine(line: string): string | null {
  const match = line.trim().match(/^tier-([0-3])$/i);
  if (!match) {
    return null;
  }
  return `tier-${match[1]}`;
}

function trimEmptyEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') {
    start += 1;
  }
  while (end > start && lines[end - 1].trim() === '') {
    end -= 1;
  }
  return lines.slice(start, end);
}

function extractEvidenceBlock(lines: string[]): {
  startIndex: number | null;
  endIndex: number | null;
  contentLines: string[];
} {
  let startIndex: number | null = null;
  let endIndex: number | null = null;
  const openFencePattern = new RegExp(`^${escapeRegex(OPEN_FENCE)}$`, 'i');
  const closeFencePattern = new RegExp(`^${escapeRegex(FENCE)}$`);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (startIndex === null && openFencePattern.test(line)) {
      startIndex = index;
      continue;
    }
    if (startIndex !== null && closeFencePattern.test(line)) {
      endIndex = index;
      break;
    }
  }

  if (startIndex === null || endIndex === null || endIndex <= startIndex) {
    return { startIndex: null, endIndex: null, contentLines: [] };
  }

  return {
    startIndex,
    endIndex,
    contentLines: lines.slice(startIndex + 1, endIndex)
  };
}

function parseEvidenceLines(lines: string[]): {
  values: Record<string, string>;
  extraLines: string[];
} {
  const values: Record<string, string> = {};
  const extraLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const separator = line.indexOf(':');
    if (separator === -1) {
      extraLines.push(line);
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!REQUIRED_FIELDS.includes(key as (typeof REQUIRED_FIELDS)[number])) {
      extraLines.push(line);
      continue;
    }
    if (!values[key]) {
      values[key] = value;
    }
  }

  return { values, extraLines };
}

export function normalizeBody(body: string): NormalizeResult {
  const normalizedInput = normalizeLineEndings(body)
    .split('\n')
    .map(stripTrailingWhitespace);

  const { startIndex, endIndex, contentLines } = extractEvidenceBlock(normalizedInput);
  const hadEvidenceBlock = startIndex !== null && endIndex !== null;
  const { values, extraLines } = parseEvidenceLines(contentLines);

  let tierLine: string | null = null;
  let removedTierLines = 0;
  const remainingLines: string[] = [];

  for (let index = 0; index < normalizedInput.length; index += 1) {
    if (startIndex !== null && endIndex !== null && index >= startIndex && index <= endIndex) {
      continue;
    }
    const line = normalizedInput[index];
    const tierCandidate = isTierLine(line);
    if (tierCandidate) {
      if (!tierLine) {
        tierLine = tierCandidate;
      } else {
        removedTierLines += 1;
      }
      continue;
    }
    remainingLines.push(line);
  }

  let insertedTierLine = false;
  if (!tierLine) {
    const evidenceTier = values['Risk Tier']?.match(/^[0-3]$/)?.[0];
    if (evidenceTier) {
      tierLine = `tier-${evidenceTier}`;
    } else {
      tierLine = 'tier-0';
      insertedTierLine = true;
    }
  }

  const riskTierValue = values['Risk Tier'] || tierLine.replace('tier-', '') || RISK_TIER_PLACEHOLDER;

  const orderedEvidenceLines = [
    `Risk Tier: ${riskTierValue || RISK_TIER_PLACEHOLDER}`,
    `Justification: ${values['Justification'] || PLACEHOLDER_VALUE}`,
    `Affected Paths: ${values['Affected Paths'] || PLACEHOLDER_VALUE}`,
    `Tests Added: ${values['Tests Added'] || PLACEHOLDER_VALUE}`,
    `Determinism Statement: ${values['Determinism Statement'] || DETERMINISM_DEFAULT}`
  ];

  const normalizedLines = [
    tierLine,
    '',
    OPEN_FENCE,
    ...orderedEvidenceLines
  ];

  if (extraLines.length > 0) {
    normalizedLines.push('');
    normalizedLines.push(...extraLines.map(stripTrailingWhitespace));
  }

  normalizedLines.push(FENCE);

  const trimmedRemaining = trimEmptyEdges(remainingLines);
  if (trimmedRemaining.length > 0) {
    normalizedLines.push('');
    normalizedLines.push(...trimmedRemaining);
  }

  return {
    normalized: normalizedLines.join('\n'),
    removedTierLines,
    insertedTierLine,
    hadEvidenceBlock
  };
}

function parseArgs(argv: string[]): { bodyFile: string } {
  if (argv.length === 0) {
    return { bodyFile: DEFAULT_BODY_FILE };
  }
  if (argv.length === 1 && !argv[0].startsWith('--')) {
    return { bodyFile: argv[0] };
  }
  throw new Error('Usage: npm run governance:normalize -- [path]');
}

function writeAtomically(targetPath: string, content: string): void {
  const directory = path.dirname(targetPath);
  const tempPath = path.join(directory, `.tmp-${path.basename(targetPath)}`);
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, targetPath);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const body = fs.existsSync(args.bodyFile) ? fs.readFileSync(args.bodyFile, 'utf8') : '';
  const result = normalizeBody(body);
  writeAtomically(args.bodyFile, result.normalized);

  const summaryLines = ['Normalized PR body.'];
  if (result.removedTierLines > 0) {
    summaryLines.push(`Removed ${result.removedTierLines} extra tier line(s).`);
  }
  if (result.insertedTierLine) {
    summaryLines.push('Inserted missing tier line (defaulted to tier-0).');
  }
  if (!result.hadEvidenceBlock) {
    summaryLines.push('Inserted missing evidence block.');
  }

  console.log(summaryLines.join(' '));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
