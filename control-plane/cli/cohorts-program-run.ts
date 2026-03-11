import { canonicalStringify } from '../finance/determinism.ts';
import { createCohortInspection } from '../cohorts/cohort-inspection.ts';
import { createCohortProgramMaterializer } from '../cohorts/programs/program-materializer.ts';

function parseArgs(argv: string[]): { programId: string; slot?: string } {
  let programId: string | undefined;
  let slot: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--program') {
      programId = argv[index + 1];
      if (!programId) {
        throw new Error('MISSING_ARGUMENT: --program');
      }
      index += 1;
      continue;
    }
    if (arg.startsWith('--program=')) {
      programId = arg.slice('--program='.length);
      if (!programId) {
        throw new Error('MISSING_ARGUMENT: --program');
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

  if (!programId) {
    throw new Error('MISSING_ARGUMENT: --program');
  }

  return {
    programId,
    ...(slot ? { slot } : {})
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createCohortInspection();
    const run = inspection.runCohortProgram(args.programId, args.slot);

    const materializer = createCohortProgramMaterializer();
    const materialized = materializer.materializeCohortPrograms({
      cohortId: run.cohortId,
      ...(args.slot ? { slot: args.slot } : {})
    });

    printJson({
      run,
      materialized
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
