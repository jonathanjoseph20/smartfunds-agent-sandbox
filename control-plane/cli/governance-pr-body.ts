import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { validatePrBody } from '../governance/pr-body.ts';

type Tier = 'tier-0' | 'tier-1' | 'tier-2' | 'tier-3';

type ParsedArgs = {
  pr: number;
  tier: Tier;
};

type RunDeps = {
  execFileSyncImpl?: typeof execFileSync;
  writeFileSyncImpl?: typeof fs.writeFileSync;
};

const REMEDIATION = 'PR body missing tier/evidence block. Fix: npm run governance:pr-body -- --pr <n> --tier <tier>';

function parseTier(value: string): Tier {
  if (value === 'tier-0' || value === 'tier-1' || value === 'tier-2' || value === 'tier-3') {
    return value;
  }
  throw new Error(`Invalid tier: ${value}. Expected one of tier-0, tier-1, tier-2, tier-3.`);
}

function parsePr(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PR number: ${value}`);
  }
  return parsed;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let pr: number | null = null;
  let tier: Tier | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      pr = parsePr(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      pr = parsePr(arg.slice('--pr='.length));
      continue;
    }
    if (arg === '--tier') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --tier.');
      }
      tier = parseTier(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--tier=')) {
      tier = parseTier(arg.slice('--tier='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (pr === null) {
    throw new Error('Missing required --pr <n> argument.');
  }
  if (tier === null) {
    throw new Error('Missing required --tier tier-0|tier-1|tier-2|tier-3 argument.');
  }

  return { pr, tier };
}

export function buildPrBody(tier: Tier): string {
  return [
    tier,
    '',
    '```evidence',
    'Risk Tier: pending',
    'Justification: pending',
    'Affected Paths: pending',
    'Tests Added: pending',
    'Determinism Statement: pending',
    '```',
    ''
  ].join('\n');
}

export function validateAppliedBody(body: string, expectedTier: Tier): void {
  const result = validatePrBody(body);
  if (result.tier !== expectedTier) {
    throw new Error(`Tier mismatch after apply. Expected ${expectedTier}, got ${result.tier}.`);
  }
}

export async function runGovernancePrBody(argv: string[], deps: RunDeps = {}): Promise<{
  pr: number;
  tier: Tier;
  bodyFile: string;
}> {
  const args = parseArgs(argv);
  const writeFileSyncImpl = deps.writeFileSyncImpl ?? fs.writeFileSync;
  const execFileSyncImpl = deps.execFileSyncImpl ?? execFileSync;

  const body = buildPrBody(args.tier);
  const bodyFile = `/tmp/pr-body-${args.pr}.md`;
  writeFileSyncImpl(bodyFile, body, 'utf8');

  execFileSyncImpl('gh', ['pr', 'edit', String(args.pr), '--body-file', bodyFile], {
    stdio: 'pipe',
    encoding: 'utf8'
  });

  const appliedBody = String(
    execFileSyncImpl('gh', ['pr', 'view', String(args.pr), '--json', 'body', '--jq', '.body'], {
      stdio: 'pipe',
      encoding: 'utf8'
    })
  );

  validateAppliedBody(appliedBody, args.tier);

  return {
    pr: args.pr,
    tier: args.tier,
    bodyFile
  };
}

async function main(): Promise<void> {
  const result = await runGovernancePrBody(process.argv.slice(2));
  console.log(`PR body updated for #${result.pr}.`);
  console.log(`Body file: ${result.bodyFile}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    console.error(REMEDIATION);
    process.exit(1);
  });
}

export { REMEDIATION };
