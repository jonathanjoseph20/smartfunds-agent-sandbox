import type { MissionIdentityPayload } from '../mission-identity.ts';
import type { MissionInstance } from '../mission-instance-types.ts';

export type TemplateParameterType = 'string' | 'number' | 'boolean';

export interface TemplateParameter {
  type: TemplateParameterType;
  required: boolean;
  description?: string;
}

export interface MissionTemplateDefinition {
  templateId: string;
  missionType: string;
  displayName: string;
  description: string;
  parameters: Record<string, TemplateParameter>;
  defaultObjectiveTemplate: string;
  defaultDeliverablesTemplate: string[];
  allowedSourceKinds: string[];
  recommendedTeams?: string[];
  tags?: string[];
}

export type NormalizedTemplateParameterValue = string | number | boolean;

export type NormalizedTemplateParameters = Record<string, NormalizedTemplateParameterValue>;

export interface MissionTemplateInstantiationInput {
  templateId: string;
  parameters: Record<string, unknown>;
  founderInstructions?: string;
}

export interface MissionTemplateInstantiationResult {
  missionId: string;
  missionIdentityPayload: MissionIdentityPayload;
  missionInstance: MissionInstance;
  parameters: NormalizedTemplateParameters;
}
