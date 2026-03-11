import { canonicalStringify } from '../finance/determinism.ts';
import { createSwarmInspection } from '../research-swarms/swarm-inspection.ts';

function parseArgs(argv: string[]): { swarmId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--swarm') {
      const swarmId = argv[index + 1];
      if (!swarmId) {
        throw new Error('MISSING_ARGUMENT: --swarm');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { swarmId };
    }
    if (arg.startsWith('--swarm=')) {
      const swarmId = arg.slice('--swarm='.length);
      if (!swarmId) {
        throw new Error('MISSING_ARGUMENT: --swarm');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { swarmId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --swarm');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createSwarmInspection();
    printJson(inspection.materializeSwarm(args.swarmId));
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
