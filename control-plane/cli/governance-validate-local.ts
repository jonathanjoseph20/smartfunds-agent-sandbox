import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { parsePullNumber } from '../governance/pr-files-api.ts';

type ParsedArgs = {
  mode: 'lite' | 'full';
  pr: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  let mode: 'lite' | 'full' = 'full';
  let pr: number | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') {
      const value = argv[index + 1];
      if (value !== 'lite' && value !== 'full') {
        throw new Error('Missing or invalid value for --mode. Use lite or full.');
      }
      mode = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      const value = arg.slice('--mode='.length);
      if (value !== 'lite' && value !== 'full') {
        throw new Error('Invalid --mode value. Use lite or full.');
      }
      mode = value;
      continue;
    }
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      pr = parsePullNumber(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      pr = parsePullNumber(arg.slice('--pr='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (pr === null) {
    throw new Error('Missing required --pr argument.');
  }

  return { mode, pr };
}

function resolveToken(): string {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(
      'Missing GITHUB_TOKEN and unable to read gh auth token.\nRun: export GITHUB_TOKEN="$(gh auth token)"'
    );
  }
}

function resolveRepository(): string {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim();
  const httpsMatch = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  throw new Error(
    'Unable to derive GITHUB_REPOSITORY from git remote.\nRun: export GITHUB_REPOSITORY="OWNER/REPO"'
  );
}

export async function runGovernanceValidateLocal(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const token = resolveToken();
  const repository = resolveRepository();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-validate-local-'));
  const eventPath = path.join(tempDir, 'github-event.json');

  try {
    fs.writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: args.pr
        },
        number: args.pr
      }),
      'utf8'
    );

    execFileSync(
      'node',
      [
        '--trace-uncaught',
        '--trace-warnings',
        '--experimental-strip-types',
        'control-plane/validate-pr.ts',
        '--mode',
        args.mode
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_NAME: 'pull_request',
          GITHUB_TOKEN: token,
          GITHUB_REPOSITORY: repository,
          GITHUB_EVENT_PATH: eventPath
        }
      }
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  await runGovernanceValidateLocal(process.argv.slice(2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { parseArgs };
