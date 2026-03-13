import { canonicalStringify } from '../finance/determinism.ts';
import { createEngineeringPlanManager } from '../engineering/engineering-plan-manager.ts';

function parseArgs(argv: string[]): { specId: string } {
  if (argv.length === 2 && argv[0] === '--spec') {
    return { specId: argv[1] };
  }

  if (argv.length === 1 && argv[0].startsWith('--spec=')) {
    const specId = argv[0].slice('--spec='.length);
    if (!specId) {
      throw new Error('MISSING_ARGUMENT: --spec');
    }
    return { specId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --spec');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const manager = createEngineeringPlanManager();

    const created = manager.createEngineeringPlan({
      specId: args.specId,
    });

    printJson({
      planId: created.planId,
      status: created.status,
    });
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
