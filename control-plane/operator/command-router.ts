import { createOperatorApiClient } from '../cli/api-client.ts';
import { parseOperatorCommand } from './schema.ts';
import type {
  OperatorCommandResult,
  OperatorRouterRequest,
  OperatorServices,
  ParsedOperatorCommand
} from './types.ts';

type CommandRouterOptions = {
  services?: OperatorServices;
  rootDir?: string;
  missionsDir?: string;
  teamsDir?: string;
  agentsDir?: string;
  workflowsDir?: string;
};

function errorResult(input: {
  source: OperatorRouterRequest['source'];
  command: string;
  error: unknown;
}): OperatorCommandResult {
  if (typeof input.error === 'object' && input.error !== null && 'code' in input.error && 'message' in input.error) {
    const typed = input.error as { code: string; message: string; details?: Record<string, unknown> };
    return {
      success: false,
      command: {
        name: input.command as OperatorCommandResult['command']['name'],
        source: input.source
      },
      error: {
        code: typed.code,
        message: typed.message,
        ...(typed.details ? { details: typed.details } : {})
      }
    };
  }

  return {
    success: false,
    command: {
      name: input.command as OperatorCommandResult['command']['name'],
      source: input.source
    },
    error: {
      code: 'COMMAND_FAILED',
      message: input.error instanceof Error ? input.error.message : 'unknown_error'
    }
  };
}

function createDefaultServices(options: CommandRouterOptions): OperatorServices {
  const api = createOperatorApiClient();

  return {
    mission: {
      startMission: async (input) => api.startMission(input.missionId, input.params),
      listMissions: () => api.listMissions(),
      inspectMission: (input) => api.inspectMission(input.missionId),
      cancelMission: (input) => api.cancelMission(input.missionId)
    },
    workflow: {
      listWorkflows: () => api.listWorkflows(),
      inspectWorkflow: (input) => api.inspectWorkflowRun(input.runId),
      traceWorkflow: (input) => api.traceWorkflowRun(input.runId)
    },
    runtime: {
      retryWorkflowNode: (input) => api.retryWorkflowNode(input.runId, input.nodeId),
      resumeWorkflow: (input) => api.resumeWorkflow(input.runId),
      cancelWorkflow: (input) => api.cancelWorkflow(input.runId)
    }
  };
}

async function dispatch(input: {
  command: ParsedOperatorCommand;
  services: OperatorServices;
}): Promise<unknown> {
  const command = input.command;

  if (command.name === 'mission:start') {
    return input.services.mission.startMission({
      missionId: command.missionId,
      params: command.params
    });
  }

  if (command.name === 'mission:list') {
    return input.services.mission.listMissions();
  }

  if (command.name === 'mission:inspect') {
    return input.services.mission.inspectMission({ missionId: command.missionId });
  }

  if (command.name === 'mission:cancel') {
    return input.services.mission.cancelMission({ missionId: command.missionId });
  }

  if (command.name === 'workflow:list') {
    return input.services.workflow.listWorkflows();
  }

  if (command.name === 'workflow:inspect') {
    return input.services.workflow.inspectWorkflow({ runId: command.runId });
  }

  if (command.name === 'workflow:trace') {
    return input.services.workflow.traceWorkflow({ runId: command.runId });
  }

  if (command.name === 'workflow:retry') {
    return input.services.runtime.retryWorkflowNode({
      runId: command.runId,
      nodeId: command.nodeId
    });
  }

  if (command.name === 'workflow:resume') {
    return input.services.runtime.resumeWorkflow({ runId: command.runId });
  }

  return input.services.runtime.cancelWorkflow({ runId: command.runId });
}

export function createOperatorCommandRouter(options: CommandRouterOptions = {}) {
  const services = options.services ?? createDefaultServices(options);

  async function route(request: OperatorRouterRequest): Promise<OperatorCommandResult> {
    const commandToken = request.argv[0] ?? 'unknown';

    try {
      const parsed = parseOperatorCommand(request.argv);
      const payload = await dispatch({
        command: parsed,
        services
      });

      return {
        success: true,
        command: {
          name: parsed.name,
          source: request.source
        },
        payload
      };
    } catch (error) {
      return errorResult({
        source: request.source,
        command: commandToken,
        error
      });
    }
  }

  return {
    route
  };
}

export type OperatorCommandRouter = ReturnType<typeof createOperatorCommandRouter>;
