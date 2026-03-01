import { canonicalStringify } from '../finance/determinism.ts';
import { runSwarmExecutor } from '../swarm/swarm-executor.ts';
import type { SwarmExecutionArgs } from '../swarm/types.ts';

function parseMode(value: string): 'structured' | 'autonomous' {
  if (value === 'structured' || value === 'autonomous') {
    return value;
  }
  throw new Error('ERR_INVALID_ARGUMENT');
}

function parseRunIndex(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('ERR_INVALID_ARGUMENT');
  }
  return parsed;
}

function parseArgs(argv: string[]): SwarmExecutionArgs {
  let projectId: string | null = null;
  let swarmId: string | null = null;
  let executionMode: 'structured' | 'autonomous' | null = null;
  let intent: string | null = null;
  let runIndex: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--project') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --project');
      }
      projectId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--project=')) {
      const value = arg.slice('--project='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --project');
      }
      projectId = value;
      continue;
    }

    if (arg === '--swarm') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --swarm');
      }
      swarmId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--swarm=')) {
      const value = arg.slice('--swarm='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --swarm');
      }
      swarmId = value;
      continue;
    }

    if (arg === '--mode') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --mode');
      }
      executionMode = parseMode(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      executionMode = parseMode(arg.slice('--mode='.length));
      continue;
    }

    if (arg === '--intent') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --intent');
      }
      intent = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--intent=')) {
      const value = arg.slice('--intent='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --intent');
      }
      intent = value;
      continue;
    }

    if (arg === '--run-index') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --run-index');
      }
      runIndex = parseRunIndex(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--run-index=')) {
      runIndex = parseRunIndex(arg.slice('--run-index='.length));
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!projectId) {
    throw new Error('MISSING_ARGUMENT: --project');
  }
  if (!swarmId) {
    throw new Error('MISSING_ARGUMENT: --swarm');
  }
  if (!executionMode) {
    throw new Error('MISSING_ARGUMENT: --mode');
  }
  if (!intent) {
    throw new Error('MISSING_ARGUMENT: --intent');
  }

  return {
    projectId,
    swarmId,
    executionMode,
    intent,
    ...(runIndex === undefined ? {} : { runIndex })
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const result = runSwarmExecutor(args);
    printJson(result);
    return result.ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ERR_SWARM_EXECUTION_FAILED';
    printJson({ error: message });
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${canonicalStringify({ error: 'ERR_SWARM_EXECUTION_FAILED' })}\n`);
    process.exit(1);
  });
}
