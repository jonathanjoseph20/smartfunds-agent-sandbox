import { canonicalStringify } from '../finance/determinism.ts';
import { createTeamCompatibilityHistoryStore } from '../team-compatibility/team-compatibility-history-store.ts';
import { createTeamCompatibilityInspection } from '../team-compatibility/team-compatibility-inspection.ts';

function parseArgs(argv: string[]): { missionId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mission') {
      const missionId = argv[index + 1];
      if (!missionId) {
        throw new Error('MISSING_ARGUMENT: --mission');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { missionId };
    }
    if (arg.startsWith('--mission=')) {
      const missionId = arg.slice('--mission='.length);
      if (!missionId) {
        throw new Error('MISSING_ARGUMENT: --mission');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { missionId };
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --mission');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createTeamCompatibilityInspection({
      historyStore: createTeamCompatibilityHistoryStore(),
    });
    printJson(inspection.materializeCompatibilityByMission(args.missionId));
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
