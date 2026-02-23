import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_OPEN = '```evidence';
const FENCE = '```';
const TIER_LINE = /^tier-([0-3])$/;
const ANY_TIER_LINE = /^tier-/;

function normalizeLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

function collectUnfencedTierLines(lines: string[]): { tierLines: string[]; nonTierLines: string[] } {
  const tierLines: string[] = [];
  const nonTierLines: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.startsWith(FENCE)) {
      if (!inFence) {
        inFence = true;
      } else if (line === FENCE) {
        inFence = false;
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (TIER_LINE.test(trimmed)) {
      tierLines.push(trimmed);
      continue;
    }

    if (ANY_TIER_LINE.test(trimmed)) {
      nonTierLines.push(trimmed);
    }
  }

  return { tierLines, nonTierLines };
}

export function parseTierLine(text: string): string {
  const lines = normalizeLines(text);
  const { tierLines, nonTierLines } = collectUnfencedTierLines(lines);

  if (nonTierLines.length > 0) {
    throw new Error(
      `Unsupported tier declaration(s): ${nonTierLines.join(', ')}. Use exactly one unfenced tier-0..tier-3 line.`
    );
  }

  if (tierLines.length === 0) {
    throw new Error('Missing unfenced tier line. Add exactly one line: tier-0, tier-1, tier-2, or tier-3.');
  }

  const unique = [...new Set(tierLines)];
  if (unique.length > 1) {
    throw new Error(`Multiple unfenced tier lines detected: ${unique.join(', ')}. Keep exactly one.`);
  }

  return unique[0];
}

export function hasEvidenceFence(text: string): void {
  const lines = normalizeLines(text);
  const openIndices = lines.reduce<number[]>((acc, line, index) => {
    if (line === EVIDENCE_OPEN) {
      acc.push(index);
    }
    return acc;
  }, []);

  if (openIndices.length === 0) {
    throw new Error('Missing evidence fence. Add a line exactly: ```evidence');
  }

  if (openIndices.length > 1) {
    throw new Error('Multiple evidence fences detected. Keep exactly one evidence block.');
  }

  const startIndex = openIndices[0];
  let endIndex: number | null = null;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index] === FENCE) {
      endIndex = index;
      break;
    }
  }

  if (endIndex === null) {
    throw new Error('Evidence fence is not closed. Add a line exactly: ```');
  }
}

export function validatePrBody(text: string): { tier: string } {
  const errors: string[] = [];
  let tier: string | null = null;

  try {
    tier = parseTierLine(text);
  } catch (error) {
    errors.push((error as Error).message);
  }

  try {
    hasEvidenceFence(text);
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return { tier: tier as string };
}

export function readBodyFile(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`PR body file not found: ${filePath}`);
  }

  const body = fs.readFileSync(resolved, 'utf8');
  if (!body.trim()) {
    throw new Error(`PR body file is empty: ${filePath}`);
  }

  return body;
}
