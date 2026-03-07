import { canonicalStringify } from '../finance/determinism.ts';
import { createOperatorCommandRouter } from './command-router.ts';

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const router = createOperatorCommandRouter();
  const result = await router.route({
    source: 'cli',
    argv
  });

  printJson(result);
  return result.success ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    printJson({
      success: false,
      command: {
        name: 'unknown',
        source: 'cli'
      },
      error: {
        code: 'UNEXPECTED_RUNTIME_ERROR',
        message: 'unexpected_runtime_error'
      }
    });
    process.exit(2);
  });
}
