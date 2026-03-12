import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { writeMissionInstance } from '../missions/mission-registry.ts';
import { instantiateMissionTemplate } from '../missions/templates/mission-template-engine.ts';

interface ParsedArgs {
  founderInstructions?: string;
  instancesDir?: string;
  paramsFile: string;
  templateId: string;
  write: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArgs(argv: string[]): ParsedArgs {
  let templateId: string | null = null;
  let paramsFile: string | null = null;
  let founderInstructions: string | undefined;
  let instancesDir: string | undefined;
  let write = false;

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

    if (arg === '--write') {
      write = true;
      continue;
    }

    if (arg === '--instances-dir') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --instances-dir');
      }
      instancesDir = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--instances-dir=')) {
      instancesDir = arg.slice('--instances-dir='.length);
      if (!instancesDir) {
        throw new Error('MISSING_ARGUMENT: --instances-dir');
      }
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
    write,
    ...(instancesDir === undefined ? {} : { instancesDir }),
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
    const instantiated = instantiateMissionTemplate(args.templateId, parameters, args.founderInstructions);

    if (args.write) {
      const persistedPath = writeMissionInstance(instantiated.missionInstance, { instancesDir: args.instancesDir });
      printJson({
        ...instantiated,
        persisted: true,
        persistedPath,
      });
      return 0;
    }

    printJson({
      ...instantiated,
      persisted: false,
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
