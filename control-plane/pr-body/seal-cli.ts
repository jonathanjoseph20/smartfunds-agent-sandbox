import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { parsePrBodyForGovernance } from './evidence-parse.ts';
import { parseEvidenceFileContent } from './evidence-file.ts';
import { fetchPrBody } from './gh-fetch.ts';
import { generateCanonicalPrBody } from './seal-body.ts';
import { validateParsedEvidence } from './evidence-validate.ts';
import type { TierLabel } from './types.ts';

type ParsedArgs = {
  pr: number;
  tier: 0 | 1 | 2 | 3 | null;
  evidenceFile: string | null;
  dryRun: boolean;
};

const REQUIRED_KEYS = [
  'Risk Tier',
  'Justification',
  'Affected Paths',
  'Tests Added',
  'Determinism Statement'
] as const;

function parseArgs(argv: string[]): ParsedArgs {
  let pr: number | null = null;
  let tier: 0 | 1 | 2 | 3 | null = null;
  let evidenceFile: string | null = null;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      pr = Number.parseInt(value, 10);
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      pr = Number.parseInt(arg.slice('--pr='.length), 10);
      continue;
    }

    if (arg === '--tier') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --tier.');
      }
      tier = Number.parseInt(value, 10) as 0 | 1 | 2 | 3;
      index += 1;
      continue;
    }
    if (arg.startsWith('--tier=')) {
      tier = Number.parseInt(arg.slice('--tier='.length), 10) as 0 | 1 | 2 | 3;
      continue;
    }

    if (arg === '--evidence-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --evidence-file.');
      }
      evidenceFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--evidence-file=')) {
      evidenceFile = arg.slice('--evidence-file='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (pr === null || !Number.isInteger(pr) || pr <= 0) {
    throw new Error('Argument --pr is required and must be a positive integer.');
  }
  return {
    pr,
    tier,
    evidenceFile,
    dryRun
  };
}

function ensureEvidenceFileExists(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Evidence file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function parseTierLabel(tier: 0 | 1 | 2 | 3): TierLabel {
  return `tier-${tier}`;
}

function runGhPrEdit(pr: number, bodyFile: string): void {
  execFileSync('gh', ['pr', 'edit', String(pr), '--body-file', bodyFile], { stdio: 'pipe' });
}

function buildNextActions(params: {
  bodyValid: boolean;
  pr: number;
  tier: 0 | 1 | 2 | 3 | null;
  evidenceFile: string | null;
}): string[] {
  const actions: string[] = [];

  if (!params.bodyValid) {
    actions.push(`Legacy PR-body metadata updated for PR ${params.pr}.`);
  }

  if (params.bodyValid) {
    actions.push('None');
  }

  return actions;
}

function printSummary(params: {
  sealed: boolean;
  tierLabel: TierLabel | null;
  bodyValid: boolean;
  missingFields: string[];
  unsupportedFields: string[];
  nextActions: string[];
  warnings: string[];
}): void {
  console.log(`Legacy PR Metadata Status: ${params.sealed ? 'updated' : 'unchanged'}`);
  console.log(`Tier: ${params.tierLabel ?? 'legacy-ignored'}`);
  console.log(`Body Valid: ${params.bodyValid ? 'yes' : 'no'}`);
  console.log(`Missing: [${params.missingFields.join(', ')}]`);
  console.log(`Unsupported: [${params.unsupportedFields.join(', ')}]`);
  console.log(`Warnings: ${params.warnings.join(' | ') || 'none'}`);
  console.log(`Next Actions: ${params.nextActions.join(' | ')}`);
}

function canonicalEvidenceFromKv(kv: Record<string, string>): {
  'Risk Tier': string;
  'Justification': string;
  'Affected Paths': string;
  'Tests Added': string;
  'Determinism Statement': string;
} {
  return {
    'Risk Tier': kv['Risk Tier'],
    'Justification': kv['Justification'],
    'Affected Paths': kv['Affected Paths'],
    'Tests Added': kv['Tests Added'],
    'Determinism Statement': kv['Determinism Statement']
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const tierLabel = args.tier === null ? null : parseTierLabel(args.tier);
  const parsedEvidenceFile = args.evidenceFile === null
    ? { kv: {}, requiredMissing: [], unsupportedKeys: [], formatErrors: [] }
    : parseEvidenceFileContent(ensureEvidenceFileExists(args.evidenceFile));
  const body = tierLabel === null || args.evidenceFile === null
    ? fetchPrBody(args.pr)
    : generateCanonicalPrBody({
        tier: tierLabel,
        evidence: canonicalEvidenceFromKv(parsedEvidenceFile.kv)
      });

  const localValidation = validateParsedEvidence(parsePrBodyForGovernance(body));

  if (args.dryRun) {
    console.log(body);
    process.exit(0);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-seal-'));
  const tempFile = path.join(tempDir, 'pr-body.md');

  try {
    fs.writeFileSync(tempFile, body.replace(/\r\n?/g, '\n'), 'utf8');
    runGhPrEdit(args.pr, tempFile);

    const ghBody = fetchPrBody(args.pr);
    const parsedBody = parsePrBodyForGovernance(ghBody);
    const validatedBody = validateParsedEvidence(parsedBody);

    const bodyValid = validatedBody.isValid;
    const nextActions = buildNextActions({
      bodyValid,
      pr: args.pr,
      tier: args.tier,
      evidenceFile: args.evidenceFile
    });

    printSummary({
      sealed: bodyValid,
      tierLabel,
      bodyValid,
      missingFields: parsedBody.requiredMissing,
      unsupportedFields: parsedBody.unsupportedKeys,
      nextActions,
      warnings: validatedBody.warnings
    });

    process.exit(0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { parseArgs, canonicalEvidenceFromKv, validateRiskTierMatch, buildNextActions, REQUIRED_KEYS };
