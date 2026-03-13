import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionControlOrchestrationInspection } from '../mission-control/mission-control-orchestration-inspection.ts';

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    if (argv.length > 0) {
      throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
    }

    printJson(createMissionControlOrchestrationInspection().listInterventionPlans());
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_ORCHESTRATION_LIST_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
