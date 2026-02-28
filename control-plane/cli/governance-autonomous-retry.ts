import { stringifyGovernanceReport } from '../governance/diagnostics.ts';
import { runAutonomousRetry } from '../governance/retry/autonomous-retry.ts';

type ParsedArgs = {
  pr?: number;
  maxRetries: number;
  dryRun: boolean;
  bodyFile?: string;
  labelsFile?: string;
};

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid ${flagName} value.`);
  }
  return parsed;
}

function parseArgs(argv: string[]): ParsedArgs {
  let pr: number | undefined;
  let maxRetries = 1;
  let dryRun = false;
  let bodyFile: string | undefined;
  let labelsFile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      pr = parsePositiveInteger(value, '--pr');
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      pr = parsePositiveInteger(arg.slice('--pr='.length), '--pr');
      continue;
    }
    if (arg === '--max-retries') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --max-retries.');
      }
      maxRetries = parsePositiveInteger(value, '--max-retries');
      index += 1;
      continue;
    }
    if (arg.startsWith('--max-retries=')) {
      maxRetries = parsePositiveInteger(arg.slice('--max-retries='.length), '--max-retries');
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
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
    if (arg === '--labels-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --labels-file.');
      }
      labelsFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--labels-file=')) {
      labelsFile = arg.slice('--labels-file='.length);
      if (!labelsFile) {
        throw new Error('Missing value for --labels-file.');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (maxRetries > 1) {
    throw new Error('Invalid --max-retries value. Maximum supported retries is 1.');
  }

  return {
    pr,
    maxRetries,
    dryRun,
    bodyFile,
    labelsFile
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await runAutonomousRetry({
    pr: args.pr,
    maxRetries: args.maxRetries,
    dryRun: args.dryRun,
    bodyFile: args.bodyFile,
    labelsFile: args.labelsFile,
    commitAndPush: true
  });

  console.log('GOVERNANCE_REPORT_JSON_START');
  console.log(stringifyGovernanceReport(result.report));
  console.log('GOVERNANCE_REPORT_JSON_END');
  process.exit(result.exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
