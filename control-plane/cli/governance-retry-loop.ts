import { runRetryLoop } from '../governance/retry/retry-loop.ts';
import type { RetryRunOptions } from '../governance/retry/types.ts';

function parseArgs(argv: string[]): RetryRunOptions {
  let pr: number | undefined;
  let dryRun: boolean | null = null;
  let verbose = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error('Invalid --pr value.');
      }
      pr = parsed;
      index += 1;
      continue;
    }

    if (arg.startsWith('--pr=')) {
      const value = arg.slice('--pr='.length);
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error('Invalid --pr value.');
      }
      pr = parsed;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--apply') {
      dryRun = false;
      continue;
    }

    if (arg === '--verbose') {
      verbose = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    pr,
    dryRun: dryRun ?? true,
    verbose
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const result = runRetryLoop(options);

  if (options.verbose) {
    console.error(`mode=${options.dryRun ? 'dry-run' : 'apply'} pr=${result.summary.pr} attempt=${result.summary.attempt}`);
  }

  console.log(JSON.stringify(result.summary));
  process.exit(result.exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(2);
  });
}
