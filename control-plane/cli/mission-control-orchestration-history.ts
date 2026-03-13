import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionControlOrchestrationInspection } from '../mission-control/mission-control-orchestration-inspection.ts';

function parseArgs(argv: string[]): { missionControlInterventionPlanId: string } {
  let missionControlInterventionPlanId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--plan') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --plan');
      }
      missionControlInterventionPlanId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--plan=')) {
      const value = arg.slice('--plan='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --plan');
      }
      missionControlInterventionPlanId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionControlInterventionPlanId) {
    throw new Error('MISSING_ARGUMENT: --plan');
  }

  return { missionControlInterventionPlanId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

function toStableError(error: unknown): string {
  return (error as Error).message === 'MISSION_CONTROL_ORCHESTRATION_PLAN_NOT_FOUND'
    ? 'intervention_plan_not_found'
    : (error as Error).message;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(createMissionControlOrchestrationInspection().inspectOrchestrationHistory(args));
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_ORCHESTRATION_HISTORY_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
