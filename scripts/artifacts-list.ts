import fs from 'node:fs';
import path from 'node:path';

type ParsedArgs = {
  runId: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  let runId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--run') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --run');
      }
      runId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--run=')) {
      runId = arg.slice('--run='.length);
      if (!runId) {
        throw new Error('MISSING_ARGUMENT: --run');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!runId) {
    throw new Error('MISSING_ARGUMENT: --run');
  }

  return { runId };
}

function findRunDirectory(root: string, runId: string): string {
  if (!fs.existsSync(root)) {
    throw new Error(`ARTIFACT_RUN_NOT_FOUND: ${runId}`);
  }

  const missionDirs = fs.readdirSync(root)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => path.join(root, name))
    .filter((absolute) => fs.statSync(absolute).isDirectory());

  const matches: string[] = [];
  for (const missionDir of missionDirs) {
    const runDir = path.join(missionDir, runId);
    if (fs.existsSync(runDir) && fs.statSync(runDir).isDirectory()) {
      matches.push(runDir);
    }
  }

  if (matches.length === 0) {
    throw new Error(`ARTIFACT_RUN_NOT_FOUND: ${runId}`);
  }

  return matches.sort((left, right) => left.localeCompare(right))[0];
}

function listFiles(runDir: string): string[] {
  return fs.readdirSync(runDir)
    .sort((left, right) => left.localeCompare(right))
    .filter((name) => fs.statSync(path.join(runDir, name)).isFile());
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const runDir = findRunDirectory(path.join('.', 'artifacts'), args.runId);
    const files = listFiles(runDir);

    process.stdout.write(`Artifacts for ${args.runId}\n\n`);
    for (const file of files) {
      process.stdout.write(`${file}\n`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_runtime_error';
    process.stdout.write(`${message}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write('unexpected_runtime_error\n');
    process.exit(2);
  });
}
