import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { instantiateMissionTemplate } from '../missions/templates/mission-template-engine.ts';

interface ParsedArgs {
  founderInstructions?: string;
  paramsFile: string;
  templateId: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArgs(argv: string[]): ParsedArgs {
  let templateId: string | null = null;
  let paramsFile: string | null = null;
  let founderInstructions: string | undefined;

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

    if (arg === '--params-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --params-file');
      }
      paramsFile = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--params-file=')) {
      paramsFile = arg.slice('--params-file='.length);
      if (!paramsFile) {
        throw new Error('MISSING_ARGUMENT: --params-file');
      }
      continue;
    }

    if (arg === '--founder-instructions') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error('MISSING_ARGUMENT: --founder-instructions');
      }
      founderInstructions = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--founder-instructions=')) {
      founderInstructions = arg.slice('--founder-instructions='.length);
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!templateId) {
    throw new Error('MISSING_ARGUMENT: --template');
  }
  if (!paramsFile) {
    throw new Error('MISSING_ARGUMENT: --params-file');
  }

  return {
    templateId,
    paramsFile,
    ...(founderInstructions === undefined ? {} : { founderInstructions }),
  };
}

function readParamsFile(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!isPlainObject(parsed)) {
    throw new Error('Invalid params file: expected JSON object');
  }

  return parsed;
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const parameters = readParamsFile(args.paramsFile);
    printJson(instantiateMissionTemplate(args.templateId, parameters, args.founderInstructions));
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
