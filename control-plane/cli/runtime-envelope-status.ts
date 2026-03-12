import { canonicalStringify } from '../finance/determinism.ts';
import { createRuntimeEnvelopeInspection } from '../runtime-envelope/runtime-envelope-inspection.ts';

function parseArgs(argv: string[]): { runtimeEnvelopeId: string; runtimeEnvelopePolicyId?: string } {
  let runtimeEnvelopeId: string | null = null;
  let runtimeEnvelopePolicyId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--envelope') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --envelope');
      }
      runtimeEnvelopeId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--envelope=')) {
      const value = arg.slice('--envelope='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --envelope');
      }
      runtimeEnvelopeId = value;
      continue;
    }

    if (arg === '--policy') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      runtimeEnvelopePolicyId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--policy=')) {
      const value = arg.slice('--policy='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      runtimeEnvelopePolicyId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!runtimeEnvelopeId) {
    throw new Error('MISSING_ARGUMENT: --envelope');
  }

  return {
    runtimeEnvelopeId,
    ...(runtimeEnvelopePolicyId ? { runtimeEnvelopePolicyId } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createRuntimeEnvelopeInspection();
    printJson(inspection.runtimeEnvelopeStatus(args));
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
