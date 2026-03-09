import path from 'node:path';

import { collectRunsFromArtifacts } from './artifacts-utils.ts';

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    if (argv.length > 0) {
      throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
    }

    const artifactsRoot = path.join('.', 'artifacts');
    const runs = collectRunsFromArtifacts(artifactsRoot);

    if (runs.length === 0) {
      process.stdout.write('No runs found. Artifacts directory is missing or empty.\n');
      return 0;
    }

    process.stdout.write('Available Runs\n\n');
    for (const run of runs) {
      process.stdout.write(`${run.runId}  ${run.missionId}\n`);
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
