import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionCoordinationInspection } from '../mission-control/mission-coordination-inspection.ts';

function parseArgs(argv: string[]): { missionRunId: string } {
  let missionRunId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--run') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --run');
      }
      missionRunId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--run=')) {
      const value = arg.slice('--run='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --run');
      }
      missionRunId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionRunId) {
    throw new Error('MISSING_ARGUMENT: --run');
  }

  return { missionRunId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createMissionCoordinationInspection().inspectMissionInterventions(args));
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
