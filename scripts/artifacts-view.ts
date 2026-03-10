import path from 'node:path';

import { listFilesInDirectory, readFilePreview, readRunMetadata, resolveUniqueRunDirectory } from './artifacts-utils.ts';

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

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const resolved = resolveUniqueRunDirectory(path.join('.', 'artifacts'), args.runId);
    const files = listFilesInDirectory(resolved.directory);
    const metadata = readRunMetadata(resolved.directory);

    const report = readFilePreview(path.join(resolved.directory, 'report.md'), 80);
    const dataset = readFilePreview(path.join(resolved.directory, 'dataset.csv'), 20);

    process.stdout.write('=== REPORT ===\n\n');
    process.stdout.write(`Mission ID: ${resolved.missionId}\n`);
    process.stdout.write(`Run ID: ${resolved.runId}\n\n`);
    if (metadata.profile) {
      process.stdout.write(`Profile: ${metadata.profile}\n`);
    }
    if (metadata.executionPath) {
      process.stdout.write(`Execution Path: ${metadata.executionPath}\n`);
    }
    if (typeof metadata.artifactCount === 'number') {
      process.stdout.write(`Artifact Count: ${String(metadata.artifactCount)}\n`);
    }
    if (typeof metadata.branchName === 'string') {
      process.stdout.write(`Branch: ${metadata.branchName}\n`);
    }
    if (typeof metadata.prNumber === 'number') {
      process.stdout.write(`PR Number: ${String(metadata.prNumber)}\n`);
    }
    if (typeof metadata.prUrl === 'string') {
      process.stdout.write(`PR URL: ${metadata.prUrl}\n`);
    }
    if (metadata.profile || metadata.executionPath || typeof metadata.artifactCount === 'number' || metadata.branchName || typeof metadata.prNumber === 'number' || metadata.prUrl) {
      process.stdout.write('\n');
    }

    if (report.exists) {
      process.stdout.write(`${report.content}\n`);
    } else {
      process.stdout.write('report.md not found for this run.\n');
    }

    process.stdout.write('\n=== DATASET ===\n\n');
    if (dataset.exists) {
      process.stdout.write(`${dataset.content}\n`);
    } else {
      process.stdout.write('dataset.csv not found for this run.\n');
    }

    const otherArtifacts = files.filter((file) => file !== 'report.md' && file !== 'dataset.csv');

    process.stdout.write('\n=== OTHER ARTIFACTS ===\n\n');
    if (otherArtifacts.length === 0) {
      process.stdout.write('none\n');
    } else {
      for (const file of otherArtifacts) {
        process.stdout.write(`${file}\n`);
      }
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
