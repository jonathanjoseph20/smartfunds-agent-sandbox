// SmartFunds Agent OS – Cockpit Types
// All types are read-only view representations of canonical operator data.

export type MissionStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
export type RunStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying' | 'timed_out' | 'recovering' | 'recovered';
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying' | 'timed_out' | 'recovering' | 'recovered' | 'cancelled' | 'skipped';

export interface MissionParameter {
  key: string;
  value: string;
}

export interface AgentProfile {
  agentId: string;
  role: string;
  profile: string;
}

export interface TeamRoster {
  teamId: string;
  agents: AgentProfile[];
}

export interface Mission {
  missionId: string;
  status: MissionStatus;
  teamId: string;
  workflowId: string;
  parameters: MissionParameter[];
  workflowRuns: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowNode {
  nodeId: string;
  label: string;
  status: NodeStatus;
  dependsOn: string[];
  agentId: string;
  adapterId: string;
  inputs: Record<string, unknown>;
  previousOutputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  timeoutMs?: number;
  timeoutState?: 'none' | 'warning' | 'triggered';
  recoveryState?: 'none' | 'entered' | 'completed' | 'failed';
  failureDetails?: FailureDetails;
}

export interface FailureDetails {
  code: string;
  message: string;
  nodeId: string;
  agentId: string;
  adapterId: string;
  retryExhausted: boolean;
  timeoutClassification?: string;
  safetyViolation?: boolean;
  recoverySummary?: string;
  suggestedAction: string;
  cliCommand: string;
  slackCommand: string;
}

export interface WorkflowRun {
  runId: string;
  missionId: string;
  workflowId: string;
  status: RunStatus;
  nodes: WorkflowNode[];
  activeNodeId?: string;
  failedNodeId?: string;
  completedNodeCount: number;
  totalNodeCount: number;
  retryCount: number;
  recoveryState?: string;
  cancellationFlag: boolean;
  startedAt: string;
  completedAt?: string;
  teamId: string;
}

export interface TraceEvent {
  timestamp: string;
  eventType: 'run_started' | 'node_entered' | 'node_completed' | 'node_failed' | 'retry_scheduled' | 'retry_attempt' | 'timeout_triggered' | 'recovery_entered' | 'recovery_completed' | 'cancellation_requested' | 'cancellation_finalized';
  nodeId?: string;
  agentId?: string;
  detail: string;
  sequence: number;
}

export interface CommandEnvelope<T = unknown> {
  command: {
    name: string;
    source: 'cli' | 'slack' | 'internal';
  };
  payload: T;
  success: boolean;
}

export interface WorkflowDefinition {
  workflowId: string;
  label: string;
  nodes: WorkflowNode[];
}
