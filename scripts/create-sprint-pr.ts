import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { validatePrBody } from '../control-plane/governance/pr-body.ts';

type ParsedArgs = {
  tier: 0 | 1 | 2 | 3;
  title?: string;
  create: boolean;
  bootstrapLabels: boolean;
};

type RunDeps = {
  execFileSyncImpl?: typeof execFileSync;
  readFileSyncImpl?: typeof fs.readFileSync;
  writeFileSyncImpl?: typeof fs.writeFileSync;
  existsSyncImpl?: typeof fs.existsSync;
};

const PR_BODY_FILE = '.pr-body.md';
const PR_LABELS_FILE = '.pr-labels.txt';

function parseTier(value: string): 0 | 1 | 2 | 3 {
  const parsed = Number.parseInt(value, 10);
  if (parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3) {
    return parsed;
  }
  throw new Error(`Invalid --tier value: ${value}`);
}

export function parseArgs(argv: string[]): ParsedArgs {
  let tier: 0 | 1 | 2 | 3 | null = null;
  let title: string | undefined;
  let create = true;
  let bootstrapLabels = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
      continue;
    }
    if (arg === '--no-create') {
      create = false;
      continue;
    }
    if (arg === '--no-bootstrap-labels') {
      bootstrapLabels = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (tier === null) {
    throw new Error('Missing required --tier <0|1|2|3> argument.');
  }

  return { tier, title, create, bootstrapLabels };
}

function runCommand(
  execFileSyncImpl: typeof execFileSync,
  command: string,
  args: string[],
  allowFail = false
): string {
  try {
    return String(execFileSyncImpl(command, args, { encoding: 'utf8', stdio: 'pipe' })).trim();
  } catch (error) {
    if (allowFail) {
      return '';
    }
    const stdout = (error as { stdout?: string | Buffer }).stdout;
    const stderr = (error as { stderr?: string | Buffer }).stderr;
    const outText = Buffer.isBuffer(stdout) ? stdout.toString('utf8') : stdout ?? '';
    const errText = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : stderr ?? '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${outText}\n${errText}`.trim());
  }
}

function parseExistingLabels(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

export function buildCanonicalLabels(tier: 0 | 1 | 2 | 3, existingLabels: string[] = []): string {
  const labels = new Set<string>([`tier-${tier}`]);
  if (existingLabels.includes('codex')) {
    labels.add('codex');
  }
  return Array.from(labels).sort((left, right) => left.localeCompare(right)).join('\n');
}

export function runCreateSprintPr(argv: string[], deps: RunDeps = {}): {
  tier: string;
  created: boolean;
} {
  const args = parseArgs(argv);
  const execFileSyncImpl = deps.execFileSyncImpl ?? execFileSync;
  const readFileSyncImpl = deps.readFileSyncImpl ?? fs.readFileSync;
  const writeFileSyncImpl = deps.writeFileSyncImpl ?? fs.writeFileSync;
  const existsSyncImpl = deps.existsSyncImpl ?? fs.existsSync;

  const existingLabels = existsSyncImpl(PR_LABELS_FILE)
    ? parseExistingLabels(String(readFileSyncImpl(PR_LABELS_FILE, 'utf8')))
    : [];
  writeFileSyncImpl(PR_LABELS_FILE, `${buildCanonicalLabels(args.tier, existingLabels)}\n`, 'utf8');

  runCommand(execFileSyncImpl, 'npm', ['run', 'governance:generate', '--', '--tier', String(args.tier), '--out', PR_BODY_FILE]);
  runCommand(execFileSyncImpl, 'npm', ['run', 'governance:normalize', '--', PR_BODY_FILE]);
  runCommand(execFileSyncImpl, 'npm', ['run', 'governance:preflight']);
  runCommand(execFileSyncImpl, 'npm', ['run', 'pr:body:check', '--', '--body-file', PR_BODY_FILE]);

  const body = String(readFileSyncImpl(PR_BODY_FILE, 'utf8'));
  validatePrBody(body);

  if (args.bootstrapLabels) {
    runCommand(execFileSyncImpl, 'npm', ['run', 'bootstrap:labels', '--', '--yes']);
  }

  if (!args.create) {
    process.stdout.write('Generated canonical PR metadata files.\n');
    process.stdout.write('Next step: npm run pr:create -- --title "<title>"\n');
    return {
      tier: `tier-${args.tier}`,
      created: false
    };
  }

  const ghAvailable = runCommand(execFileSyncImpl, 'gh', ['--version'], true);
  const ghAuth = runCommand(execFileSyncImpl, 'gh', ['auth', 'status', '-h', 'github.com'], true);
  if (!ghAvailable || !ghAuth) {
    throw new Error(
      'GitHub CLI is unavailable or not authenticated. Install/authenticate gh, then run: npm run pr:create -- --title "<title>"'
    );
  }

  const createArgs = ['run', 'pr:create', '--'];
  if (args.title) {
    createArgs.push('--title', args.title);
  }
  runCommand(execFileSyncImpl, 'npm', createArgs);
  runCommand(execFileSyncImpl, 'npm', ['run', 'pr:verify']);

  return {
    tier: `tier-${args.tier}`,
    created: true
  };
}

async function main(): Promise<void> {
  const result = runCreateSprintPr(process.argv.slice(2));
  process.stdout.write(`Sprint PR helper complete. Tier: ${result.tier}. Created: ${String(result.created)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.stderr.write('Remediation: ensure gh auth is valid and rerun, or use --no-create to only generate metadata files.\n');
    process.exit(1);
  });
}
