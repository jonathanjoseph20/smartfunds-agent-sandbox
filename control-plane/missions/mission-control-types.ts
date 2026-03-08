export type MissionArtifactType = 'document' | 'dataset' | 'code' | 'report' | 'analysis';

export type MissionArtifactDefinition = {
  name: string;
  type: MissionArtifactType;
};

export type MissionTemplateDefinition = {
  missionId: string;
  title: string;
  missionType: string;
  projectId: string;
  workflowId: string;
  background?: string;
  objectives: string[];
  successCriteria: string[];
  deliverables: string[];
  artifacts: MissionArtifactDefinition[];
  teamId: string;
  workflow: string[];
  agentOverrides?: Record<string, { style?: string }>;
  customAgents?: Array<{
    name: string;
    skills: string[];
  }>;
};

export type MissionTeamRegistry = {
  schemaVersion: number;
  teams: string[];
};

export type MissionTeamRole = {
  slotId: string;
  agentId: string;
};

export type MissionTeamDefinition = {
  teamId: string;
  teamType: 'persistent' | 'specialized';
  persistence: 'persistent' | 'ephemeral';
  description: string;
  capabilities: string[];
  missionCompatibility: string[];
  tools: string[];
  roles: MissionTeamRole[];
};

export type MissionAgentDefinition = {
  agentId: string;
  skills: string[];
  personality: {
    riskPosture: string;
    communication: string;
  };
  tools: string[];
};

export type MissionRegistryBundle = {
  registry: MissionTeamRegistry;
  teams: MissionTeamDefinition[];
  agents: MissionAgentDefinition[];
};

export const RUNTIME_MISSION_PHASES = ['init', 'planning', 'execution', 'verification', 'delivery'] as const;
export type RuntimeMissionPhase = (typeof RUNTIME_MISSION_PHASES)[number];

export type RuntimeMissionStatus = 'created' | 'running' | 'completed' | 'failed';

export type RuntimeMissionState = {
  missionId: string;
  template: string;
  teamId: string;
  status: RuntimeMissionStatus;
  phase: RuntimeMissionPhase;
};

export type RuntimeMissionRecord = {
  missionId: string;
  template: MissionTemplateDefinition;
  status: RuntimeMissionState;
  rootDir: string;
  artifactsDir: string;
  logsDir: string;
};
