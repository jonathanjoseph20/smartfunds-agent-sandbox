import { canonicalStringify } from '../finance/determinism.ts';
import { createCohortInspection } from '../cohorts/cohort-inspection.ts';

function parseArgs(argv: string[]): { cohortId: string; slot: string } {
  let cohortId: string | undefined;
  let slot: string | undefined;

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
      slot = argv[index + 1];
      if (!slot) {
        throw new Error('MISSING_ARGUMENT: --slot');
      }
      index += 1;
      continue;
    }

    if (arg.startsWith('--slot=')) {
      slot = arg.slice('--slot='.length);
      if (!slot) {
        throw new Error('MISSING_ARGUMENT: --slot');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!cohortId) {
    throw new Error('MISSING_ARGUMENT: --cohort');
  }
  if (!slot) {
    throw new Error('MISSING_ARGUMENT: --slot');
  }

  return { cohortId, slot };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createCohortInspection();
    printJson(inspection.inspectCohortAutomationStatus(args));
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
