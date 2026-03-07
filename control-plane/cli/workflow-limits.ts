import { canonicalStringify } from '../finance/determinism.ts';
import { DEFAULT_RUNTIME_SAFETY_LIMITS } from '../runtime/safety-limits.ts';

function parseArgs(argv: string[]): void {
  for (const arg of argv) {
    if (arg === '--json') {
      continue;
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    parseArgs(argv);
    const limits = {
      ...DEFAULT_RUNTIME_SAFETY_LIMITS
    };

    printJson(limits);
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
