import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { createProductSpecManager } from '../products/product-spec-manager.ts';

function parseArgs(argv: string[]): { filePath: string } {
  if (argv.length === 2 && argv[0] === '--file') {
    return { filePath: argv[1] };
  }

  if (argv.length === 1 && argv[0].startsWith('--file=')) {
    const filePath = argv[0].slice('--file='.length);
    if (!filePath) {
      throw new Error('MISSING_ARGUMENT: --file');
    }
    return { filePath };
  }

  if (argv.length === 0) {
    throw new Error('MISSING_ARGUMENT: --file');
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const payload = JSON.parse(fs.readFileSync(args.filePath, 'utf8')) as Record<string, unknown>;

    const manager = createProductSpecManager();
    const created = manager.createProductSpec(payload);

    printJson({
      specId: created.specId,
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
