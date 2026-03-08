import type { OperatorCommandError, ParsedOperatorCommand } from './types.ts';

function sortedObject(input: Record<string, string>): Record<string, string> {
  const entries = Object.entries(input).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function toError(code: string, message: string, details?: Record<string, unknown>): OperatorCommandError {
  return {
    code,
    message,
    ...(details ? { details } : {})
  };
}

function parseValueFlag(token: string, name: string): string | null {
  if (token === name) {
    return '';
  }
  if (token.startsWith(`${name}=`)) {
    return token.slice(name.length + 1);
  }
  return null;
}

function parseKeyValueArgs(argv: string[]): { params: Record<string, string>; consumed: number } {
  const params: Record<string, string> = {};
  let index = 0;

  while (index < argv.length) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw toError('INVALID_ARGUMENT', `Unexpected token: ${token}`);
    }

    const inlineSplit = token.indexOf('=');
    if (inlineSplit >= 0) {
      const key = token.slice(2, inlineSplit);
      const value = token.slice(inlineSplit + 1);
      if (!key) {
        throw toError('INVALID_ARGUMENT', `Invalid flag: ${token}`);
      }
      params[key] = value;
      index += 1;
      continue;
    }

    const key = token.slice(2);
    if (!key) {
      throw toError('INVALID_ARGUMENT', `Invalid flag: ${token}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw toError('MISSING_ARGUMENT', `Missing value for --${key}`);
    }

    params[key] = value;
    index += 2;
  }

  return {
    params: sortedObject(params),
    consumed: index
  };
}

function parseRunOption(argv: string[]): { runId: string; consumed: number } {
  let runId: string | null = null;
  let index = 0;

  while (index < argv.length) {
    const token = argv[index];
    const parsed = parseValueFlag(token, '--run');
    if (parsed === null) {
      throw toError('INVALID_ARGUMENT', `Unknown argument: ${token}`);
    }

    if (token === '--run') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw toError('MISSING_ARGUMENT', 'Missing value for --run');
      }
      runId = value;
      index += 2;
      continue;
    }

    if (!parsed) {
      throw toError('MISSING_ARGUMENT', 'Missing value for --run');
    }

    runId = parsed;
    index += 1;
  }

  if (!runId) {
    throw toError('MISSING_ARGUMENT', 'Missing required --run');
  }

  return {
    runId,
    consumed: index
  };
}

function parseRunNodeOptions(argv: string[]): { runId: string; nodeId: string; consumed: number } {
  let runId: string | null = null;
  let nodeId: string | null = null;
  let index = 0;

  while (index < argv.length) {
    const token = argv[index];

    if (token.startsWith('--run')) {
      const parsed = parseValueFlag(token, '--run');
      if (parsed === null) {
        throw toError('INVALID_ARGUMENT', `Unknown argument: ${token}`);
      }

      if (token === '--run') {
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) {
          throw toError('MISSING_ARGUMENT', 'Missing value for --run');
        }
        runId = value;
        index += 2;
        continue;
      }

      if (!parsed) {
        throw toError('MISSING_ARGUMENT', 'Missing value for --run');
      }

      runId = parsed;
      index += 1;
      continue;
    }

    if (token.startsWith('--node')) {
      const parsed = parseValueFlag(token, '--node');
      if (parsed === null) {
        throw toError('INVALID_ARGUMENT', `Unknown argument: ${token}`);
      }

      if (token === '--node') {
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) {
          throw toError('MISSING_ARGUMENT', 'Missing value for --node');
        }
        nodeId = value;
        index += 2;
        continue;
      }

      if (!parsed) {
        throw toError('MISSING_ARGUMENT', 'Missing value for --node');
      }

      nodeId = parsed;
      index += 1;
      continue;
    }

    throw toError('INVALID_ARGUMENT', `Unknown argument: ${token}`);
  }

  if (!runId) {
    throw toError('MISSING_ARGUMENT', 'Missing required --run');
  }
  if (!nodeId) {
    throw toError('MISSING_ARGUMENT', 'Missing required --node');
  }

  return {
    runId,
    nodeId,
    consumed: index
  };
}

function requireSinglePositional(argv: string[], label: string): string {
  if (argv.length === 0) {
    throw toError('MISSING_ARGUMENT', `Missing required ${label}`);
  }
  if (argv.length > 1) {
    throw toError('INVALID_ARGUMENT', `Unexpected arguments after ${label}`);
  }
  if (argv[0].startsWith('--')) {
    throw toError('INVALID_ARGUMENT', `Expected ${label}, received option ${argv[0]}`);
  }
  return argv[0];
}

export function parseOperatorCommand(argv: string[]): ParsedOperatorCommand {
  if (argv.length === 0) {
    throw toError('MISSING_COMMAND', 'Missing operator command');
  }

  const [command, ...rest] = argv;

  if (command === 'mission') {
    const action = rest[0];
    const args = rest.slice(1);

    if (action === 'create') {
      return {
        name: 'mission:create',
        templateId: requireSinglePositional(args, '<templateId>')
      };
    }

    if (action === 'list') {
      if (args.length > 0) {
        throw toError('INVALID_ARGUMENT', 'mission list does not accept arguments');
      }
      return { name: 'mission:runtime-list' };
    }

    if (action === 'run') {
      return {
        name: 'mission:run',
        missionId: requireSinglePositional(args, '<missionId>')
      };
    }

    if (action === 'status') {
      return {
        name: 'mission:status',
        missionId: requireSinglePositional(args, '<missionId>')
      };
    }

    throw toError('UNKNOWN_COMMAND', `Unknown command: mission ${action ?? ''}`.trim(), { command: ['mission', ...(action ? [action] : [])].join(' ') });
  }

  if (command === 'mission:create') {
    return {
      name: 'mission:create',
      templateId: requireSinglePositional(rest, '<templateId>')
    };
  }

  if (command === 'mission:run') {
    return {
      name: 'mission:run',
      missionId: requireSinglePositional(rest, '<missionId>')
    };
  }

  if (command === 'mission:status') {
    return {
      name: 'mission:status',
      missionId: requireSinglePositional(rest, '<missionId>')
    };
  }

  if (command === 'mission:runtime-list') {
    if (rest.length > 0) {
      throw toError('INVALID_ARGUMENT', 'mission:runtime-list does not accept arguments');
    }
    return { name: 'mission:runtime-list' };
  }

  if (command === 'mission:list') {
    if (rest.length > 0) {
      throw toError('INVALID_ARGUMENT', 'mission:list does not accept arguments');
    }
    return { name: 'mission:list' };
  }

  if (command === 'mission:start') {
    if (rest.length === 0) {
      throw toError('MISSING_ARGUMENT', 'Missing required <missionId>');
    }

    const missionId = rest[0];
    if (missionId.startsWith('--')) {
      throw toError('INVALID_ARGUMENT', `Expected missionId, received option ${missionId}`);
    }

    const { params } = parseKeyValueArgs(rest.slice(1));
    return {
      name: 'mission:start',
      missionId,
      params
    };
  }

  if (command === 'mission:inspect') {
    return {
      name: 'mission:inspect',
      missionId: requireSinglePositional(rest, '<missionId>')
    };
  }

  if (command === 'mission:cancel') {
    return {
      name: 'mission:cancel',
      missionId: requireSinglePositional(rest, '<missionId>')
    };
  }

  if (command === 'workflow:list') {
    if (rest.length > 0) {
      throw toError('INVALID_ARGUMENT', 'workflow:list does not accept arguments');
    }
    return { name: 'workflow:list' };
  }

  if (command === 'workflow:inspect') {
    if (rest.length === 1 && !rest[0].startsWith('--')) {
      return {
        name: 'workflow:inspect',
        runId: rest[0]
      };
    }

    const parsed = parseRunOption(rest);
    if (parsed.consumed !== rest.length) {
      throw toError('INVALID_ARGUMENT', 'Invalid workflow:inspect arguments');
    }

    return {
      name: 'workflow:inspect',
      runId: parsed.runId
    };
  }

  if (command === 'workflow:trace') {
    if (rest.length === 1 && !rest[0].startsWith('--')) {
      return {
        name: 'workflow:trace',
        runId: rest[0]
      };
    }

    const parsed = parseRunOption(rest);
    if (parsed.consumed !== rest.length) {
      throw toError('INVALID_ARGUMENT', 'Invalid workflow:trace arguments');
    }

    return {
      name: 'workflow:trace',
      runId: parsed.runId
    };
  }

  if (command === 'workflow:retry') {
    const parsed = parseRunNodeOptions(rest);
    if (parsed.consumed !== rest.length) {
      throw toError('INVALID_ARGUMENT', 'Invalid workflow:retry arguments');
    }

    return {
      name: 'workflow:retry',
      runId: parsed.runId,
      nodeId: parsed.nodeId
    };
  }

  if (command === 'workflow:resume') {
    const parsed = parseRunOption(rest);
    if (parsed.consumed !== rest.length) {
      throw toError('INVALID_ARGUMENT', 'Invalid workflow:resume arguments');
    }

    return {
      name: 'workflow:resume',
      runId: parsed.runId
    };
  }

  if (command === 'workflow:cancel') {
    const parsed = parseRunOption(rest);
    if (parsed.consumed !== rest.length) {
      throw toError('INVALID_ARGUMENT', 'Invalid workflow:cancel arguments');
    }

    return {
      name: 'workflow:cancel',
      runId: parsed.runId
    };
  }

  throw toError('UNKNOWN_COMMAND', `Unknown command: ${command}`, { command });
}
