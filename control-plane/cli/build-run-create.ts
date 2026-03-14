import { canonicalStringify } from '../finance/determinism.ts';
import { createBuildExecutionManager } from '../build-runtime/build-execution-manager.ts';

function parseArgs(argv: string[]): { packetId: string; bundleId: string } {
  if (argv.length === 4 && argv[0] === '--packet' && argv[2] === '--bundle') {
    return {
      packetId: argv[1]!,
      bundleId: argv[3]!,
    };
  }

  if (argv.length === 2 && argv[0]!.startsWith('--packet=') && argv[1]!.startsWith('--bundle=')) {
    const packetId = argv[0]!.slice('--packet='.length);
    const bundleId = argv[1]!.slice('--bundle='.length);

    if (!packetId) {
      throw new Error('MISSING_ARGUMENT: --packet');
    }
    if (!bundleId) {
      throw new Error('MISSING_ARGUMENT: --bundle');
    }

    return { packetId, bundleId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --packet');
  }

  if (!argv.some((entry) => entry === '--packet' || entry.startsWith('--packet='))) {
    throw new Error('MISSING_ARGUMENT: --packet');
  }

  throw new Error(argv.some((entry) => entry === '--bundle' || entry.startsWith('--bundle='))
    ? `UNKNOWN_ARGUMENT: ${argv[0]}`
    : 'MISSING_ARGUMENT: --bundle');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const manager = createBuildExecutionManager();
    const summary = manager.createBuildExecutionRun(args.packetId, args.bundleId);
    printJson({
      runId: summary.runId,
      packetId: summary.packetId,
      bundleId: summary.bundleId,
    });
    return 0;
  } catch (error) {
    printJson({ error: (error as Error).message });
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${canonicalStringify({ error: 'unexpected_runtime_error' })}\n`);
    process.exit(2);
  });
}
