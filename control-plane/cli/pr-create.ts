import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { readBodyFile, validatePrBody } from '../governance/pr-body.ts';
import { verifyPrBodyOnGh } from './pr-verify.ts';

const DEFAULT_BODY_FILE = '.pr-body.md';

type ParsedArgs = {
  title?: string;
  bodyFile: string;
  runNormalize: boolean;
  runPreflight: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  let title: string | undefined;
  let bodyFile = DEFAULT_BODY_FILE;
  let runNormalize = false;
  let runPreflight = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--title') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --title.');
      }
      title = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--title=')) {
      title = arg.slice('--title='.length);
      if (!title) {
        throw new Error('Missing value for --title.');
      }
      continue;
    }
    if (arg === '--body-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --body-file.');
      }
      bodyFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--body-file=')) {
      bodyFile = arg.slice('--body-file='.length);
      if (!bodyFile) {
        throw new Error('Missing value for --body-file.');
      }
      continue;
    }
    if (arg === '--normalize') {
      runNormalize = true;
      continue;
    }
    if (arg === '--preflight') {
      runPreflight = true;
      continue;
    }
    if (arg === '--prep') {
      runNormalize = true;
      runPreflight = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { title, bodyFile, runNormalize, runPreflight };
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

function resolveTitle(explicitTitle?: string): string {
  if (explicitTitle) {
    return explicitTitle;
  }
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  return `chore: ${branch}`;
}

function runGovernanceNormalize(bodyFile: string): void {
  execFileSync('npm', ['run', 'governance:normalize', '--', bodyFile], { stdio: 'inherit' });
}

function runGovernancePreflight(): void {
  execFileSync('npm', ['run', 'governance:preflight'], { stdio: 'inherit' });
}

function ensureBodyFilePresent(bodyFile: string): void {
  if (!fs.existsSync(bodyFile)) {
    throw new Error(`PR body file not found: ${bodyFile}`);
  }
  const body = fs.readFileSync(bodyFile, 'utf8');
  if (!body.trim()) {
    throw new Error(`PR body file is empty: ${bodyFile}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  ensureBodyFilePresent(args.bodyFile);

  if (args.runNormalize) {
    runGovernanceNormalize(args.bodyFile);
  }

  const body = readBodyFile(args.bodyFile);
  validatePrBody(body);

  if (args.runPreflight) {
    runGovernancePreflight();
  }

  ensureGhAvailable();
  ensureGhAuthenticated();

  const title = resolveTitle(args.title);

  execFileSync('gh', ['pr', 'create', '--title', title, '--body-file', args.bodyFile], { stdio: 'inherit' });

  const verified = verifyPrBodyOnGh();
  console.log(`PR created and verified. Tier: ${verified.tier}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    console.error('Remediation: ensure .pr-body.md exists, is non-empty, and contains the required tier/evidence structure.');
    process.exit(1);
  });
}
