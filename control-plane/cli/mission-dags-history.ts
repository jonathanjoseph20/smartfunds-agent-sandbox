import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionDAGInspection } from '../missions/dag/mission-dag-inspection.ts';

function parseArgs(argv: string[]): { dagId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dag') {
      const dagId = argv[index + 1];
      if (!dagId) {
        throw new Error('MISSING_ARGUMENT: --dag');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { dagId };
    }
    if (arg.startsWith('--dag=')) {
      const dagId = arg.slice('--dag='.length);
      if (!dagId) {
        throw new Error('MISSING_ARGUMENT: --dag');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { dagId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --dag');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createMissionDAGInspection();
    printJson(inspection.getMissionDAGHistory(args.dagId));
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
