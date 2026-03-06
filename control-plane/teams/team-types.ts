export type TeamExecutionMode = 'structured' | 'autonomous';

export type TeamDefinition = {
  teamId: string;
  name: string;
  projectId: string;
  members: string[];
  executionMode: TeamExecutionMode;
  description?: string;
  teamObjective?: string;
  defaultWorkflowIds?: string[];
  constraints?: string[];
  handoffRules?: string[];
  notes?: string;
};
