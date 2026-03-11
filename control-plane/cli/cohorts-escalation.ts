import { canonicalStringify } from '../finance/determinism.ts';
import { createCohortInspection } from '../cohorts/cohort-inspection.ts';

function parseArgs(argv: string[]): { cohortId: string; slotOrReference?: string; evaluate: boolean } {
  let cohortId: string | undefined;
  let slotOrReference: string | undefined;
  let evaluate = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--cohort') {
      cohortId = argv[index + 1];
      if (!cohortId) {
        throw new Error('MISSING_ARGUMENT: --cohort');
      }
      index += 1;
      continue;
    }

    if (arg.startsWith('--cohort=')) {
      cohortId = arg.slice('--cohort='.length);
      if (!cohortId) {
        throw new Error('MISSING_ARGUMENT: --cohort');
      }
      continue;
    }

    if (arg === '--slot') {
      slotOrReference = argv[index + 1];
      if (!slotOrReference) {
        throw new Error('MISSING_ARGUMENT: --slot');
      }
      index += 1;
      continue;
    }

    if (arg.startsWith('--slot=')) {
      slotOrReference = arg.slice('--slot='.length);
      if (!slotOrReference) {
        throw new Error('MISSING_ARGUMENT: --slot');
      }
      continue;
    }

    if (arg === '--evaluate') {
      evaluate = true;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!cohortId) {
    throw new Error('MISSING_ARGUMENT: --cohort');
  }

  return {
    cohortId,
    ...(slotOrReference ? { slotOrReference } : {}),
    evaluate
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createCohortInspection();

    if (args.evaluate) {
      printJson(inspection.evaluateCohortEscalation({
        cohortId: args.cohortId,
        ...(args.slotOrReference ? { slotOrReference: args.slotOrReference } : {})
      }));
    } else {
      printJson(inspection.inspectCohortEscalation({
        cohortId: args.cohortId,
        ...(args.slotOrReference ? { slotOrReference: args.slotOrReference } : {})
      }));
    }

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
