import { canonicalStringify } from '../finance/determinism.ts';
import { createCodexExecutionPacketManager } from '../codex/codex-execution-packet-manager.ts';

function parseArgs(argv: string[]): { graphId: string } {
  if (argv.length === 2 && argv[0] === '--graph') {
    return { graphId: argv[1]! };
  }

  if (argv.length === 1 && argv[0]!.startsWith('--graph=')) {
    const graphId = argv[0]!.slice('--graph='.length);
    if (!graphId) {
      throw new Error('MISSING_ARGUMENT: --graph');
    }

    return { graphId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --graph');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const manager = createCodexExecutionPacketManager();
    const result = manager.createCodexExecutionPackets(args.graphId);
    printJson({
      packetCount: result.packetCount,
      packetIds: result.packetIds,
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
