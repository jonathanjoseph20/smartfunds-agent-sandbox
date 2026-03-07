export interface WorkflowDefinition {
  workflowId: string;
  nodes: WorkflowNode[];
}

export interface WorkflowNode {
  id: string;
  task: string;
  agent?: string;
  dependsOn?: string[];
  phase?: string;
}

export interface ValidatedWorkflowDefinition {
  workflowId: string;
  nodes: WorkflowNode[];
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
}

export interface WorkflowExecutionContext {
  missionId: string;
  workflowId: string;
  workflowNodeId: string;
  previousOutputs: Record<string, unknown>;
}

export interface WorkflowNodeExecutionResult {
  workflowNodeId: string;
  task: string;
  agentId?: string;
  output: unknown;
}

export interface WorkflowRunResult {
  missionId: string;
  workflowId: string;
  executionOrder: string[];
  nodeResults: WorkflowNodeExecutionResult[];
}

export interface RunnableNode {
  id: string;
  task: string;
  agent?: string;
  dependsOn: string[];
  phase?: string;
}

export interface WorkflowInspectResult {
  workflowId: string;
  nodes: Array<{
    id: string;
    task: string;
    agent?: string;
    phase?: string;
    dependsOn: string[];
  }>;
  executionOrder: string[];
}
