import { canonicalStringify } from '../finance/determinism.ts';
import { createActionPlanInspection } from '../action-orchestration/action-plan-inspection.ts';

function parseArgs(argv: string[]): { actionPlanId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--plan') {
      const actionPlanId = argv[index + 1];
      if (!actionPlanId) {
        throw new Error('MISSING_ARGUMENT: --plan');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { actionPlanId };
    }
    if (arg.startsWith('--plan=')) {
      const actionPlanId = arg.slice('--plan='.length);
      if (!actionPlanId) {
        throw new Error('MISSING_ARGUMENT: --plan');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { actionPlanId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --plan');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createActionPlanInspection();
    printJson(inspection.getPlanReadiness(args.actionPlanId));
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
