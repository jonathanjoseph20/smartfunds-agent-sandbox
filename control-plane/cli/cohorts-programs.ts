import { canonicalStringify } from '../finance/determinism.ts';
import { createCohortInspection } from '../cohorts/cohort-inspection.ts';

function parseArgs(argv: string[]): { cohortId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--cohort') {
      const cohortId = argv[index + 1];
      if (!cohortId) {
        throw new Error('MISSING_ARGUMENT: --cohort');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { cohortId };
    }

    if (arg.startsWith('--cohort=')) {
      const cohortId = arg.slice('--cohort='.length);
      if (!cohortId) {
        throw new Error('MISSING_ARGUMENT: --cohort');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { cohortId };
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --cohort');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createCohortInspection();
    printJson(inspection.listCohortPrograms(args.cohortId));
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
