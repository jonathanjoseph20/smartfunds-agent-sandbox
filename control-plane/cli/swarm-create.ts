import { canonicalStringify } from '../finance/determinism.ts';
import { createSwarmRunner } from '../swarm/swarm-runner.ts';
import type { RunKind } from '../journal/types.ts';

type ParsedArgs = {
  projectId: string;
  kind?: RunKind;
  entrypoint?: string;
};

function parseKind(value: string): RunKind {
  if (value === 'swarm' || value === 'mission' || value === 'maintenance' || value === 'governance') {
    return value;
  }
  throw new Error('INVALID_ARGUMENT: kind');
}

function parseArgs(argv: string[]): ParsedArgs {
  let projectId: string | null = null;
  let kind: RunKind | undefined;
  let entrypoint: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--project') {
      const value = argv[index + 1];
      if (!value) throw new Error('MISSING_ARGUMENT: --project');
      projectId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--project=')) {
      projectId = arg.slice('--project='.length);
      if (!projectId) throw new Error('MISSING_ARGUMENT: --project');
      continue;
    }

    if (arg === '--kind') {
      const value = argv[index + 1];
      if (!value) throw new Error('MISSING_ARGUMENT: --kind');
      kind = parseKind(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--kind=')) {
      kind = parseKind(arg.slice('--kind='.length));
      continue;
    }

    if (arg === '--entrypoint') {
      const value = argv[index + 1];
      if (!value) throw new Error('MISSING_ARGUMENT: --entrypoint');
      entrypoint = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--entrypoint=')) {
      entrypoint = arg.slice('--entrypoint='.length);
      if (!entrypoint) throw new Error('MISSING_ARGUMENT: --entrypoint');
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!projectId) {
    throw new Error('MISSING_ARGUMENT: --project');
  }

  return {
    projectId,
    ...(kind ? { kind } : {}),
    ...(entrypoint ? { entrypoint } : {})
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const runner = createSwarmRunner();
    const summary = runner.createSwarmRun({
      projectId: args.projectId,
      kind: args.kind,
      entrypoint: args.entrypoint
    });

    printJson(summary);
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
