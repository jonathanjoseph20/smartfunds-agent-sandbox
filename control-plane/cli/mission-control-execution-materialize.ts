import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionExecutionCoordinationManager } from '../mission-control/mission-execution-coordination-manager.ts';

function parseArgs(argv: string[]): { missionExecutionCoordinationPlanId: string } {
  let missionExecutionCoordinationPlanId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--plan') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --plan');
      }
      missionExecutionCoordinationPlanId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--plan=')) {
      const value = arg.slice('--plan='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --plan');
      }
      missionExecutionCoordinationPlanId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionExecutionCoordinationPlanId) {
    throw new Error('MISSING_ARGUMENT: --plan');
  }

  return { missionExecutionCoordinationPlanId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

function toStableError(error: unknown): string {
  return (error as Error).message === 'MISSION_EXECUTION_COORDINATION_PLAN_NOT_FOUND'
    ? 'execution_coordination_plan_not_found'
    : (error as Error).message;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createMissionExecutionCoordinationManager().materializeExecutionCoordinationPlan(args));
    return 0;
  } catch (error) {
    printJson({ error: toStableError(error) });
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_EXECUTION_MATERIALIZE_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
