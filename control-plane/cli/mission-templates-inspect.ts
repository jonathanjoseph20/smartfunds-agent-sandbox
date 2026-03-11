import { canonicalStringify } from '../finance/determinism.ts';
import { getMissionTemplate } from '../missions/templates/mission-template-registry.ts';

function parseArgs(argv: string[]): { templateId: string } {
  let templateId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--template') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --template');
      }
      templateId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--template=')) {
      templateId = arg.slice('--template='.length);
      if (!templateId) {
        throw new Error('MISSING_ARGUMENT: --template');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!templateId) {
    throw new Error('MISSING_ARGUMENT: --template');
  }

  return { templateId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    printJson(getMissionTemplate(args.templateId));
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
