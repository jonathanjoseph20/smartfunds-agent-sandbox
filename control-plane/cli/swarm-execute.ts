import { canonicalStringify } from '../finance/determinism.ts';
import { runSwarmExecution, type SwarmExecutionArgs } from '../swarms/swarmExecutor.ts';

type ParsedArgs = SwarmExecutionArgs;

function parseMode(value: string): 'structured' | 'autonomous' {
  if (value === 'structured' || value === 'autonomous') {
    return value;
  }
  throw new Error('INVALID_ARGUMENT: executionMode');
}

function parseArgs(argv: string[]): ParsedArgs {
  let swarmId: string | null = null;
  let projectId: string | null = null;
  let taskIntent: string | null = null;
  let executionMode: 'structured' | 'autonomous' | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

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
      swarmId = arg.slice('--swarm='.length);
      if (!swarmId) {
        throw new Error('MISSING_ARGUMENT: --swarm');
      }
      continue;
    }

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
      projectId = arg.slice('--project='.length);
      if (!projectId) {
        throw new Error('MISSING_ARGUMENT: --project');
      }
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
      taskIntent = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--intent=')) {
      taskIntent = arg.slice('--intent='.length);
      if (!taskIntent) {
        throw new Error('MISSING_ARGUMENT: --intent');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!swarmId) {
    throw new Error('MISSING_ARGUMENT: --swarm');
  }
  if (!projectId) {
    throw new Error('MISSING_ARGUMENT: --project');
  }
  if (!executionMode) {
    throw new Error('MISSING_ARGUMENT: --mode');
  }
  if (!taskIntent) {
    throw new Error('MISSING_ARGUMENT: --intent');
  }

  return {
    swarmId,
    projectId,
    executionMode,
    taskIntent
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

function isDeterministicValidationError(error: unknown): boolean {
  const message = (error as Error).message;
  return typeof message === 'string' && (
    message.startsWith('INVALID_ARGUMENT:') ||
    message.startsWith('MISSING_ARGUMENT:') ||
    message.startsWith('UNKNOWN_ARGUMENT:') ||
    message.startsWith('SWARM_') ||
    message.startsWith('PROJECT_') ||
    message.startsWith('TEAM_') ||
    message.startsWith('MODE_MISMATCH:') ||
    message.startsWith('ENTITY_BINDING_') ||
    message.startsWith('RAIL_BINDING_') ||
    message.startsWith('ARTIFACT_PATH_OUTSIDE_PROJECT_BOUNDS:') ||
    message.startsWith('BRANCH_ALREADY_EXISTS:')
  );
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const result = await runSwarmExecution(args);
    printJson(result);
    return 0;
  } catch (error) {
    if (isDeterministicValidationError(error)) {
      printJson({ error: (error as Error).message });
      return 1;
    }

    printJson({ error: 'unexpected_runtime_error' });
    return 2;
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
