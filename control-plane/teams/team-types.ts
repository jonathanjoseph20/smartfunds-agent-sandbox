export type TeamExecutionMode = 'structured' | 'autonomous';

// Legacy runtime team definition shape (kept for backward compatibility).
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

export const TEAM_TYPES = [
  'research',
  'venture',
  'product',
  'engineering',
  'legal',
  'operations',
  'marketing',
  'devops',
  'finance',
  'agent_operations',
  'multi_domain',
] as const;

export const TEAM_LIFECYCLE_STATES = ['defined', 'active', 'dormant', 'archived'] as const;

export const TEAM_AVAILABILITY_STATES = ['available', 'restricted', 'unavailable', 'manual_only'] as const;

export const TEAM_READINESS_STATES = ['ready', 'partial', 'blocked', 'incomplete', 'inconclusive'] as const;

export const TEAM_OPERATING_MODES = ['continuous', 'on_demand', 'dormant_reserve'] as const;

export const TEAM_ROSTER_POLICY_TYPES = ['fixed', 'expandable', 'placeholder'] as const;

export type TeamType = typeof TEAM_TYPES[number];
export type TeamLifecycleState = typeof TEAM_LIFECYCLE_STATES[number];
export type TeamAvailabilityState = typeof TEAM_AVAILABILITY_STATES[number];
export type TeamReadinessState = typeof TEAM_READINESS_STATES[number];
export type TeamOperatingMode = typeof TEAM_OPERATING_MODES[number];
export type TeamRosterPolicyType = typeof TEAM_ROSTER_POLICY_TYPES[number];
