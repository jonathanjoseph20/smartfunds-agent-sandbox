export const SUPPORTED_AGENT_ADAPTERS = ['llm', 'repo', 'shell'] as const;

export type AgentAdapterType = (typeof SUPPORTED_AGENT_ADAPTERS)[number];

export type PersonalityProfile = {
  tone: string;
  reasoningStyle: string;
  temperament: string;
  collaborationStyle: string;
  communicationStyle: string;
};

export type SkillsProfile = {
  coreSkills: string[];
  secondarySkills?: string[];
  domains: string[];
};

export type BackgroundProfile = {
  professionalArchetype: string;
  domainBackground: string[];
  perspectiveBiases?: string[];
};

export type OutputProfile = {
  preferredFormat: string;
  verbosity: 'low' | 'medium' | 'high';
  citationStyle: string;
  decisionStyle: string;
};

export type ConstraintsProfile = {
  mustDo: string[];
  mustNotDo: string[];
};

export type ToolProfile = {
  allowedAdapters: AgentAdapterType[];
  preferredTools: AgentAdapterType[];
  forbiddenTools: AgentAdapterType[];
};

export type AgentProfileDefinition = {
  agentId: string;
  displayName: string;
  role: string;
  projectId: string;
  adapterType: AgentAdapterType;
  personalityProfile: PersonalityProfile;
  skillsProfile: SkillsProfile;
  backgroundProfile: BackgroundProfile;
  outputProfile: OutputProfile;
  constraintsProfile: ConstraintsProfile;
  toolProfile: ToolProfile;
  notes?: string;
};
