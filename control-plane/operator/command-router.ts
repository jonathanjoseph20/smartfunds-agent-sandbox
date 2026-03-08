import { createMissionService } from './mission-service.ts';
import { createRuntimeService } from './runtime-service.ts';
import { parseOperatorCommand } from './schema.ts';
import { createWorkflowService } from './workflow-service.ts';
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
  missionTemplatesDir?: string;
  runtimeMissionsDir?: string;
  missionTeamRegistryPath?: string;
  missionTeamsDir?: string;
  missionAgentsDir?: string;
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
  const missionService = createMissionService({
    rootDir: options.rootDir,
    missionsDir: options.missionsDir,
    missionTemplatesDir: options.missionTemplatesDir,
    runtimeMissionsDir: options.runtimeMissionsDir,
    missionTeamRegistryPath: options.missionTeamRegistryPath,
    missionTeamsDir: options.missionTeamsDir,
    missionAgentsDir: options.missionAgentsDir,
    teamsDir: options.teamsDir,
    agentsDir: options.agentsDir,
    workflowsDir: options.workflowsDir
  });
  const workflowService = createWorkflowService({
    rootDir: options.rootDir
  });
  const runtimeService = createRuntimeService({
    rootDir: options.rootDir,
    workflowsDir: options.workflowsDir
  });

  return {
    mission: {
      createMission: (input) => missionService.createMission({ templateId: input.templateId }),
      runMission: async (input) => missionService.runMission({ missionId: input.missionId }),
      missionStatus: (input) => missionService.missionStatus({ missionId: input.missionId }),
      listRuntimeMissions: () => missionService.listRuntimeMissions(),
      startMission: async (input) => missionService.startMission({ missionId: input.missionId, params: input.params }),
      listMissions: () => missionService.listMissions(),
      inspectMission: (input) => missionService.inspectMission({ missionId: input.missionId }),
      cancelMission: (input) => missionService.cancelMission({ missionId: input.missionId })
    },
    workflow: {
      listWorkflows: () => workflowService.listWorkflows(),
      inspectWorkflow: (input) => workflowService.inspectWorkflow({ runId: input.runId }),
      traceWorkflow: (input) => workflowService.traceWorkflow({ runId: input.runId })
    },
    runtime: {
      retryWorkflowNode: (input) => runtimeService.retryWorkflowNode({ runId: input.runId, nodeId: input.nodeId }),
      resumeWorkflow: (input) => runtimeService.resumeWorkflow({ runId: input.runId }),
      cancelWorkflow: (input) => runtimeService.cancelWorkflow({ runId: input.runId })
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

  if (command.name === 'mission:create') {
    return input.services.mission.createMission({ templateId: command.templateId });
  }

  if (command.name === 'mission:run') {
    return input.services.mission.runMission({ missionId: command.missionId });
  }

  if (command.name === 'mission:status') {
    return input.services.mission.missionStatus({ missionId: command.missionId });
  }

  if (command.name === 'mission:runtime-list') {
    return input.services.mission.listRuntimeMissions();
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
