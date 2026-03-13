import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionExecutionCoordinationInspection } from '../mission-control/mission-execution-coordination-inspection.ts';

function parseArgs(argv: string[]): { missionExecutionCoordinationPlanId: string } {
  let missionExecutionCoordinationPlanId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--plan' || arg === '--planId') {
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

    if (arg.startsWith('--planId=')) {
      const value = arg.slice('--planId='.length);
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

function toStableError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown_error';
  return message === 'MISSION_EXECUTION_COORDINATION_PLAN_NOT_FOUND'
    ? 'execution_coordination_plan_not_found'
    : message;
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const result = createMissionExecutionCoordinationInspection().inspectExecutionCoordinationPlan(args);
    printJson(result);
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_EXECUTION_INSPECT_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
