import type {
  MissionProposalCreatedByKind,
  MissionProposalCreatedFromKind,
  MissionProposalPriority,
} from './mission-proposal-types.ts';

export interface MissionProposalDefinition {
  proposalType: string;
  displayName: string;
  description: string;
  summary: string;
  enabled: boolean;
  recommendedPriority: MissionProposalPriority;
  defaultProposedMissionType: string;
  defaultProposedTemplateId?: string;
  supportedMissionTypes: string[];
  supportedTemplateIds: string[];
  allowedCreatedByKinds: MissionProposalCreatedByKind[];
  allowedCreatedFromKinds: MissionProposalCreatedFromKind[];
}
