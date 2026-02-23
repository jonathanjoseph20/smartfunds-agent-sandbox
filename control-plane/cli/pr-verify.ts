import { execFileSync } from 'node:child_process';

import { validatePrBody } from '../governance/pr-body.ts';

type ParsedArgs = {
  prRef?: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  let prRef: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      prRef = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      prRef = arg.slice('--pr='.length);
      if (!prRef) {
        throw new Error('Missing value for --pr.');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { prRef };
}

function ensureGhAvailable(): void {
  try {
    execFileSync('gh', ['--version'], { stdio: 'pipe' });
  } catch {
    throw new Error('GitHub CLI (gh) is required. Install gh and ensure it is on PATH.');
  }
}

function ensureGhAuthenticated(): void {
  try {
    execFileSync('gh', ['auth', 'status', '-h', 'github.com'], { stdio: 'pipe' });
  } catch {
    throw new Error('GitHub CLI is not authenticated. Run: gh auth login');
  }
}

export function fetchPrBodyFromGh(prRef?: string): string {
  ensureGhAvailable();
  ensureGhAuthenticated();

  const args = ['pr', 'view'];
  if (prRef) {
    args.push(prRef);
  }
  args.push('--json', 'body', '--jq', '.body');

  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

export function verifyPrBodyOnGh(prRef?: string): { tier: string } {
  const body = fetchPrBodyFromGh(prRef);
  return validatePrBody(body);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = verifyPrBodyOnGh(args.prRef);
  console.log(`PR body verified on GitHub. Tier: ${result.tier}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    console.error('Remediation: ensure the PR body contains exactly one unfenced tier-0..tier-3 line and an evidence fence.');
    process.exit(1);
  });
}
