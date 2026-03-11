import { canonicalStringify } from '../finance/determinism.ts';
import { createCrossSwarmInspection } from '../cross-swarms/cross-swarm-inspection.ts';

function parseArgs(argv: string[]): { crossSwarmId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cross-swarm') {
      const crossSwarmId = argv[index + 1];
      if (!crossSwarmId) {
        throw new Error('MISSING_ARGUMENT: --cross-swarm');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { crossSwarmId };
    }
    if (arg.startsWith('--cross-swarm=')) {
      const crossSwarmId = arg.slice('--cross-swarm='.length);
      if (!crossSwarmId) {
        throw new Error('MISSING_ARGUMENT: --cross-swarm');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { crossSwarmId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --cross-swarm');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createCrossSwarmInspection();
    printJson(inspection.materializeCrossSwarm(args.crossSwarmId));
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
