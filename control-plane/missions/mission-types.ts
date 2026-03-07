export type MissionPriority = 'low' | 'medium' | 'high' | 'critical';

export type MissionParameterSchema = {
  allowed?: string[];
  required?: string[];
  defaults?: Record<string, string>;
  descriptions?: Record<string, string>;
};

export type MissionDefinition = {
  missionId: string;
  name?: string;
  projectId: string;
  teamId: string;
  workflowId: string;
  objective: string;
  successCriteria: string[];
  deliverables: string[];
  initialContext: Record<string, unknown>;
  parameterSchema?: MissionParameterSchema;
  description?: string;
  priority?: MissionPriority;
  constraints?: string[];
  deadlineHint?: string;
  tags?: string[];
  owner?: string;
  notes?: string;
};

export type MissionExecutionSeed = {
  missionId: string;
  teamId: string;
  agentRoster: string[];
};

export type MissionRunResult = {
  mission: MissionDefinition;
  teamId: string;
  workflowId: string;
  agentRoster: string[];
  runSummary: {
    runId: string;
    status: string;
    currentPhase: string | null;
    completedPhases: string[];
    eventCount: number;
  };
};
