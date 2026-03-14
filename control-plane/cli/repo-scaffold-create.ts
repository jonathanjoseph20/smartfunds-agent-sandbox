import { canonicalStringify } from '../finance/determinism.ts';
import { createRepoScaffoldManager } from '../repo-scaffold/repo-scaffold-manager.ts';

function parseArgs(argv: string[]): { packetId: string } {
  if (argv.length === 2 && argv[0] === '--packet') {
    return { packetId: argv[1]! };
  }

  if (argv.length === 1 && argv[0]!.startsWith('--packet=')) {
    const packetId = argv[0]!.slice('--packet='.length);
    if (!packetId) {
      throw new Error('MISSING_ARGUMENT: --packet');
    }

    return { packetId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --packet');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const manager = createRepoScaffoldManager();
    printJson(manager.createRepoScaffoldBundles(args.packetId));
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
