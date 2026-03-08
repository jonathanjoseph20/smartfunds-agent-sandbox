export type OperatorCommandSource = 'cli' | 'slack';

export type OperatorCommandName =
  | 'mission:create'
  | 'mission:run'
  | 'mission:status'
  | 'mission:runtime-list'
  | 'mission:start'
  | 'mission:list'
  | 'mission:inspect'
  | 'mission:cancel'
  | 'workflow:list'
  | 'workflow:inspect'
  | 'workflow:trace'
  | 'workflow:retry'
  | 'workflow:resume'
  | 'workflow:cancel';

export type OperatorCommandError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type OperatorCommandResult = {
  success: boolean;
  command: {
    name: OperatorCommandName | 'unknown';
    source: OperatorCommandSource;
  };
  payload?: unknown;
  error?: OperatorCommandError;
};

export type OperatorRouterRequest = {
  source: OperatorCommandSource;
  argv: string[];
};

export type MissionStartCommand = {
  name: 'mission:start';
  missionId: string;
  params: Record<string, string>;
};

export type MissionCreateCommand = {
  name: 'mission:create';
  templateId: string;
};

export type MissionRunCommand = {
  name: 'mission:run';
  missionId: string;
};

export type MissionStatusCommand = {
  name: 'mission:status';
  missionId: string;
};

export type MissionRuntimeListCommand = {
  name: 'mission:runtime-list';
};

export type MissionListCommand = {
  name: 'mission:list';
};

export type MissionInspectCommand = {
  name: 'mission:inspect';
  missionId: string;
};

export type MissionCancelCommand = {
  name: 'mission:cancel';
  missionId: string;
};

export type WorkflowListCommand = {
  name: 'workflow:list';
};

export type WorkflowInspectCommand = {
  name: 'workflow:inspect';
  runId: string;
};

export type WorkflowTraceCommand = {
  name: 'workflow:trace';
  runId: string;
};

export type WorkflowRetryCommand = {
  name: 'workflow:retry';
  runId: string;
  nodeId: string;
};

export type WorkflowResumeCommand = {
  name: 'workflow:resume';
  runId: string;
};

export type WorkflowCancelCommand = {
  name: 'workflow:cancel';
  runId: string;
};

export type ParsedOperatorCommand =
  | MissionCreateCommand
  | MissionRunCommand
  | MissionStatusCommand
  | MissionRuntimeListCommand
  | MissionStartCommand
  | MissionListCommand
  | MissionInspectCommand
  | MissionCancelCommand
  | WorkflowListCommand
  | WorkflowInspectCommand
  | WorkflowTraceCommand
  | WorkflowRetryCommand
  | WorkflowResumeCommand
  | WorkflowCancelCommand;

export type OperatorServices = {
  mission: {
    createMission: (input: { templateId: string }) => unknown;
    runMission: (input: { missionId: string }) => Promise<unknown>;
    missionStatus: (input: { missionId: string }) => unknown;
    listRuntimeMissions: () => unknown;
    startMission: (input: { missionId: string; params: Record<string, string> }) => Promise<unknown>;
    listMissions: () => unknown;
    inspectMission: (input: { missionId: string }) => unknown;
    cancelMission: (input: { missionId: string }) => unknown;
  };
  workflow: {
    listWorkflows: () => unknown;
    inspectWorkflow: (input: { runId: string }) => unknown;
    traceWorkflow: (input: { runId: string }) => unknown;
  };
  runtime: {
    retryWorkflowNode: (input: { runId: string; nodeId: string }) => Promise<unknown>;
    resumeWorkflow: (input: { runId: string }) => Promise<unknown>;
    cancelWorkflow: (input: { runId: string }) => unknown;
  };
};
