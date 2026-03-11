import { canonicalStringify } from '../finance/determinism.ts';
import { createSynthesisInspection } from '../synthesis/synthesis-inspection.ts';

function parseArgs(argv: string[]): { synthesisType?: string; status?: string } {
  let synthesisType: string | undefined;
  let status: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--type') {
      synthesisType = argv[index + 1];
      if (!synthesisType) {
        throw new Error('MISSING_ARGUMENT: --type');
      }
      index += 1;
      continue;
    }

    if (arg === '--status') {
      status = argv[index + 1];
      if (!status) {
        throw new Error('MISSING_ARGUMENT: --status');
      }
      index += 1;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  return {
    ...(synthesisType ? { synthesisType } : {}),
    ...(status ? { status } : {})
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createSynthesisInspection();
    printJson(inspection.listSynthesisSets(args));
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
