import { canonicalStringify } from '../finance/determinism.ts';
import { createOperatorCommandRouter, type OperatorCommandRouter } from './command-router.ts';
import type { OperatorCommandResult } from './types.ts';

type SlackRouterOptions = {
  router?: OperatorCommandRouter;
};

function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function toOperatorArgv(tokens: string[]): string[] {
  if (tokens.length === 0) {
    throw new Error('MISSING_COMMAND');
  }

  if (tokens[0] === '/mission') {
    const [_, action, ...rest] = tokens;
    if (!action) {
      throw new Error('MISSING_COMMAND');
    }

    if (action === 'start') {
      return ['mission:start', ...rest];
    }
    if (action === 'list') {
      return ['mission:list', ...rest];
    }
    if (action === 'inspect') {
      return ['mission:inspect', ...rest];
    }
    if (action === 'cancel') {
      return ['mission:cancel', ...rest];
    }

    throw new Error(`UNKNOWN_COMMAND: /mission ${action}`);
  }

  if (tokens[0] === '/workflow') {
    const [_, action, ...rest] = tokens;
    if (!action) {
      throw new Error('MISSING_COMMAND');
    }

    if (action === 'list') {
      return ['workflow:list', ...rest];
    }
    if (action === 'inspect') {
      return ['workflow:inspect', ...rest];
    }
    if (action === 'trace') {
      return ['workflow:trace', ...rest];
    }
    if (action === 'retry') {
      return ['workflow:retry', ...rest];
    }
    if (action === 'resume') {
      return ['workflow:resume', ...rest];
    }
    if (action === 'cancel') {
      return ['workflow:cancel', ...rest];
    }

    throw new Error(`UNKNOWN_COMMAND: /workflow ${action}`);
  }

  throw new Error(`UNKNOWN_COMMAND: ${tokens[0]}`);
}

export function createSlackCommandRouter(options: SlackRouterOptions = {}) {
  const router = options.router ?? createOperatorCommandRouter();

  async function routeSlackText(text: string): Promise<OperatorCommandResult> {
    try {
      const argv = toOperatorArgv(tokenize(text));
      return router.route({
        source: 'slack',
        argv
      });
    } catch (error) {
      return {
        success: false,
        command: {
          name: 'unknown',
          source: 'slack'
        },
        error: {
          code: 'SLACK_PARSE_ERROR',
          message: error instanceof Error ? error.message : 'invalid_slack_command'
        }
      };
    }
  }

  async function toSlackResponse(text: string): Promise<Record<string, unknown>> {
    const result = await routeSlackText(text);
    return {
      response_type: 'ephemeral',
      ok: result.success,
      result,
      text: canonicalStringify(result)
    };
  }

  return {
    routeSlackText,
    toSlackResponse
  };
}

export type SlackCommandRouter = ReturnType<typeof createSlackCommandRouter>;
