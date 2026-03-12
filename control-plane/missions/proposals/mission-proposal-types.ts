import type { DeliverableDescriptor, SourceReference } from '../mission-types.ts';

export const MISSION_PROPOSAL_STATES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
  'archived',
] as const;

export const MISSION_PROPOSAL_APPROVAL_STATES = [
  'pending_review',
  'approved',
  'rejected',
  'not_required',
] as const;

export const MISSION_PROPOSAL_CONVERSION_STATES = [
  'not_converted',
  'mission_created',
  'mission_linked_existing',
  'conversion_blocked',
  'conversion_inconclusive',
] as const;

export const MISSION_PROPOSAL_PRIORITIES = [
  'low',
  'normal',
  'high',
  'critical',
] as const;

export const MISSION_PROPOSAL_CREATED_BY_KINDS = [
  'founder',
  'agent',
  'system',
] as const;

export const MISSION_PROPOSAL_CREATED_FROM_KINDS = [
  'action_plan',
  'portfolio_intelligence',
  'market_synthesis',
  'mission',
  'dag',
  'manual',
] as const;

export const MISSION_PROPOSAL_HISTORY_EVENT_TYPES = [
  'proposal_created',
  'proposal_submitted',
  'proposal_review_started',
  'proposal_approved',
  'proposal_rejected',
  'proposal_withdrawn',
  'proposal_archived',
  'proposal_materialized',
  'proposal_conversion_attempted',
  'proposal_converted_to_mission',
  'proposal_linked_existing_mission',
  'proposal_conversion_blocked',
] as const;

export type MissionProposalState = typeof MISSION_PROPOSAL_STATES[number];
export type MissionProposalApprovalState = typeof MISSION_PROPOSAL_APPROVAL_STATES[number];
export type MissionProposalConversionState = typeof MISSION_PROPOSAL_CONVERSION_STATES[number];
export type MissionProposalPriority = typeof MISSION_PROPOSAL_PRIORITIES[number];
export type MissionProposalCreatedByKind = typeof MISSION_PROPOSAL_CREATED_BY_KINDS[number];
export type MissionProposalCreatedFromKind = typeof MISSION_PROPOSAL_CREATED_FROM_KINDS[number];
export type MissionProposalHistoryEventType = typeof MISSION_PROPOSAL_HISTORY_EVENT_TYPES[number];

export interface MissionProposalCreatedBy {
  kind: MissionProposalCreatedByKind;
  id: string;
  displayName: string;
}

export interface MissionProposalCreatedFrom {
  kind: MissionProposalCreatedFromKind;
  id: string;
  reason?: string;
}

export interface MissionProposalInstance {
  proposalId: string;
  proposalType: string;
  displayName: string;
  summary: string;
  objective: string;
  rationale: string;
  proposedMissionType: string;
  proposedTemplateId: string;
  proposedParameters: Record<string, unknown>;
  proposedFounderInstructions: string;
  requestedDeliverables: DeliverableDescriptor[];
  sourceReferences: SourceReference[];
  linkedMissionIds: string[];
  linkedDagIds: string[];
  linkedActionPlanIds: string[];
  linkedPortfolioIds: string[];
  createdBy: MissionProposalCreatedBy;
  createdFrom: MissionProposalCreatedFrom;
  approvalState: MissionProposalApprovalState;
  proposalState: MissionProposalState;
  blockingReasons: string[];
  limitations: string[];
  recommendedPriority: MissionProposalPriority;
  historyDigest: string;
}

export interface MissionProposalStatus {
  proposalId: string;
  proposalState: MissionProposalState;
  approvalState: MissionProposalApprovalState;
  conversionState: MissionProposalConversionState;
  blockingReasons: string[];
  limitations: string[];
}

export interface MissionProposalHistoryEntry {
  proposalId: string;
  eventType: MissionProposalHistoryEventType;
  eventDedupeKey: string;
  payload: Record<string, unknown>;
}

export interface MissionProposalHistory {
  proposalId: string;
  entries: MissionProposalHistoryEntry[];
}

export interface MissionProposalProjection {
  proposalId: string;
  proposalType: string;
  displayName: string;
  instance: Record<string, unknown>;
  status: MissionProposalStatus;
  historySummary: {
    totalEvents: number;
    lastEventType?: MissionProposalHistoryEventType;
  };
  linkedUpstreamObjects: {
    linkedMissionIds: string[];
    linkedDagIds: string[];
    linkedActionPlanIds: string[];
    linkedPortfolioIds: string[];
  };
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
    historyJsonPath: string;
    conversionJsonPath: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
  conversionPreview?: Record<string, unknown>;
}

export interface MissionProposalConversionResult {
  proposalId: string;
  conversionState: MissionProposalConversionState;
  missionId?: string;
  linkedExistingMission: boolean;
  reason: string;
}
