import { canonicalStringify } from '../finance/determinism.ts';
import { createEngineeringPlanMaterializer } from '../engineering/engineering-plan-materializer.ts';

function parseArgs(argv: string[]): { planId: string } {
  if (argv.length === 2 && argv[0] === '--plan') {
    return { planId: argv[1] };
  }

  if (argv.length === 1 && argv[0].startsWith('--plan=')) {
    const planId = argv[0].slice('--plan='.length);
    if (!planId) {
      throw new Error('MISSING_ARGUMENT: --plan');
    }
    return { planId };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --plan');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const materializer = createEngineeringPlanMaterializer();
    printJson(materializer.materializeEngineeringPlan(args.planId));
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
