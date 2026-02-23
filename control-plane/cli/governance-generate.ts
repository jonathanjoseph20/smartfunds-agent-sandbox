import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BACKTICK = String.fromCharCode(0o140);
const FENCE = BACKTICK.repeat(3);
const OPEN_FENCE = `${FENCE}evidence`;

type GitExec = (args: string[]) => string;

type GenerateOptions = {
  tier: number;
  changedPaths: string[];
};

type ParsedArgs = {
  tier: number;
  outFile?: string;
};

function defaultGitExec(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    const stdout = (error as { stdout?: string | Buffer }).stdout;
    if (typeof stdout === 'string') {
      return stdout.trim();
    }
    if (Buffer.isBuffer(stdout)) {
      return stdout.toString('utf8').trim();
    }
    throw error;
  }
}

function parseTier(value: string): number {
  if (!value) {
    throw new Error('Missing value for --tier.');
  }
  const parsed = Number.parseInt(value, 10);
  if (![0, 1, 2, 3].includes(parsed)) {
    throw new Error('Tier must be 0, 1, 2, or 3.');
  }
  return parsed;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let tier: number | null = null;
  let outFile: string | undefined;

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
    if (arg === '--out') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --out.');
      }
      outFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--out=')) {
      outFile = arg.slice('--out='.length);
      if (!outFile) {
        throw new Error('Missing value for --out.');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (tier === null) {
    throw new Error('Missing required --tier argument.');
  }

  return { tier, outFile };
}

function collectChangedPaths(execGit: GitExec): string[] {
  const output = execGit(['diff', '--name-only', 'main...HEAD']);
  if (!output) {
    return [];
  }
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function generateBody(options: GenerateOptions): string {
  const orderedPaths = [...options.changedPaths].sort((a, b) => a.localeCompare(b));
  const affectedPaths = orderedPaths.length > 0
    ? orderedPaths.join(', ')
    : 'none';

  const lines = [
    `tier-${options.tier}`,
    '',
    OPEN_FENCE,
    `Risk Tier: ${options.tier}`,
    'Justification: <placeholder>',
    `Affected Paths: ${affectedPaths}`,
    'Tests Added: <placeholder>',
    'Determinism Statement: Deterministic; no randomness, no hidden mutation, sorted output.',
    FENCE,
    '',
    '### Determinism Requirements',
    '- Backticks generated programmatically (ASCII \\140)',
    '- LF line endings only',
    '- No trailing whitespace',
    '- Deterministic field ordering',
    '- Sorted path output',
    '- Stable placeholder ordering'
  ];

  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const changedPaths = collectChangedPaths(defaultGitExec);
  const body = generateBody({ tier: args.tier, changedPaths });

  if (args.outFile) {
    fs.writeFileSync(args.outFile, body, 'utf8');
    console.log(`Wrote PR body template to ${args.outFile}.`);
    return;
  }

  console.log(body);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
