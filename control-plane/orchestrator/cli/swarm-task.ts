import { spawnTask, stableStringify } from '../swarm-task.ts';

type ParsedArgs = {
  help: boolean;
  dryRun: boolean;
  printReport: boolean;
  printPlan: boolean;
  executionMode: 'structured' | 'autonomous';
};

const USAGE = 'Usage: npm run swarm:task -- [--execution-mode structured|autonomous] [--dry-run] [--print-report] [--print-plan] [--help]';

export function parseArgs(argv: string[]): ParsedArgs {
  let help = false;
  let dryRun = false;
  let printReport = false;
  let printPlan = false;
  let executionMode: 'structured' | 'autonomous' = 'structured';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help') {
      help = true;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--print-report') {
      printReport = true;
      continue;
    }

    if (arg === '--print-plan') {
      printPlan = true;
      continue;
    }

    if (arg === '--execution-mode') {
      const value = argv[index + 1];
      if (!value || (value !== 'structured' && value !== 'autonomous')) {
        throw new Error('Invalid value for --execution-mode. Use structured|autonomous.');
      }
      executionMode = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--execution-mode=')) {
      const value = arg.slice('--execution-mode='.length);
      if (value !== 'structured' && value !== 'autonomous') {
        throw new Error('Invalid value for --execution-mode. Use structured|autonomous.');
      }
      executionMode = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    help,
    dryRun,
    printReport,
    printPlan,
    executionMode
  };
}

function buildDryRunPlan(args: ParsedArgs): {
  mode: 'dry-run';
  executionMode: 'structured' | 'autonomous';
  printReport: boolean;
  printPlan: boolean;
  patchPlan: {
    version: 'v1';
    governanceErrorCode: string;
    retryAttempt: number;
    ops: Array<{ op: 'noop'; reason: string }>;
  };
  patchCommands: string[];
  steps: string[];
} {
  return {
    mode: 'dry-run',
    executionMode: args.executionMode,
    printReport: args.printReport,
    printPlan: args.printPlan,
    patchPlan: {
      version: 'v1',
      governanceErrorCode: 'N/A',
      retryAttempt: 0,
      ops: [{ op: 'noop', reason: 'dry_run_no_context' }]
    },
    patchCommands: [],
    steps: [
      'Validate CLI inputs',
      'Compute deterministic task plan',
      'Skip PR open/edit operations',
      'Skip CI polling',
      'Skip retry mutation'
    ]
  };
}

export async function main(
  argv: string[] = process.argv.slice(2),
  deps: { spawnTaskFn?: typeof spawnTask } = {}
): Promise<number> {
  const args = parseArgs(argv);
  const spawnTaskFn = deps.spawnTaskFn ?? spawnTask;

  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  if (args.dryRun) {
    process.stdout.write(`${stableStringify(buildDryRunPlan(args))}\n`);
    return 0;
  }

  const result = await spawnTaskFn({ executionMode: args.executionMode, dryRun: false });
  const payload = args.printPlan
    ? {
      patchPlan: result.executionReport.retry.patchPlan,
      patchCommands: result.executionReport.retry.patchCommands,
      patchDryRun: result.executionReport.retry.patchDryRun
    }
    : args.printReport
      ? result.executionReport
      : result;
  process.stdout.write(`${stableStringify(payload)}\n`);

  if (result.retryState.finalStatus === 'passed') {
    return 0;
  }
  if (result.retryState.finalStatus === 'pending') {
    return 0;
  }
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch((error: unknown) => {
    process.stdout.write(`${stableStringify({ error: (error as Error).message })}\n`);
    process.exit(2);
  });
}
