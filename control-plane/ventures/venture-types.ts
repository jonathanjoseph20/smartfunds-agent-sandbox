export const VENTURE_CLASSES = [
  'core_venture',
  'experimental_venture',
  'cashflow_venture',
  'moonshot_venture',
  'internal_tooling_venture',
  'spinout_candidate',
  'joint_venture_candidate',
  'inconclusive_classification',
] as const;

export const VENTURE_LIFECYCLE_STATES = [
  'defined',
  'incubating',
  'ready_for_launch',
  'operating',
  'paused',
  'stabilizing',
  'spinning_out',
  'archived',
] as const;

export const VENTURE_STATUSES = [
  'active',
  'blocked',
  'incomplete',
  'degraded',
  'manual_review_required',
  'inconclusive',
] as const;

export const VENTURE_OWNERSHIP_MODELS = [
  'internal',
  'joint_venture',
  'spinout_planned',
  'external_partnership',
] as const;

export const VENTURE_OPERATING_MODES = [
  'manual',
  'assisted',
  'autonomous',
  'dormant',
] as const;

export const VENTURE_VALIDATION_OUTCOMES = [
  'satisfied',
  'incomplete',
  'blocked',
  'inconclusive',
] as const;

export type VentureClass = typeof VENTURE_CLASSES[number];
export type VentureLifecycleState = typeof VENTURE_LIFECYCLE_STATES[number];
export type VentureStatus = typeof VENTURE_STATUSES[number];
export type VentureOwnershipModel = typeof VENTURE_OWNERSHIP_MODELS[number];
export type VentureOperatingMode = typeof VENTURE_OPERATING_MODES[number];
export type VentureValidationOutcome = typeof VENTURE_VALIDATION_OUTCOMES[number];

export interface VentureProvenanceInputs {
  source: string;
  referenceIds: string[];
  notes?: string;
}

export interface VentureDefinition {
  ventureId?: string;
  ventureName: string;
  ventureSlug: string;
  ventureClass: VentureClass;
  ventureStatus?: VentureStatus;
  ventureLifecycleState: VentureLifecycleState;
  ownershipModel: VentureOwnershipModel;
  operatingMode: VentureOperatingMode;
  originMissionIds: string[];
  linkedMissionPortfolioIds: string[];
  linkedTeamIds: string[];
  linkedEntityIds: string[];
  summary: string;
  domainTags: string[];
  productTypeTags: string[];
  jurisdictionTags: string[];
  limitations: string[];
  blockingReasons: string[];
  provenanceInputs: VentureProvenanceInputs;
}

export interface VentureValidationFinding {
  ventureId: string;
  field: string;
  code: string;
  message: string;
}

export interface VentureValidationResult {
  ventureId: string;
  valid: boolean;
  outcome: VentureValidationOutcome;
  findings: VentureValidationFinding[];
  normalized: VentureDefinition;
}

export interface VentureStatusProjection {
  ventureId: string;
  ventureLifecycleState: VentureLifecycleState;
  ventureStatus: VentureStatus;
  limitations: string[];
  blockingReasons: string[];
}

export type VentureHistoryEventType =
  | 'venture_defined'
  | 'venture_registered'
  | 'venture_status_changed'
  | 'venture_incubation_started'
  | 'venture_marked_ready_for_launch'
  | 'venture_paused'
  | 'venture_archived'
  | 'venture_team_linked'
  | 'venture_mission_linked'
  | 'venture_materialized';

export interface VentureHistoryEvent {
  ventureId: string;
  eventType: VentureHistoryEventType;
  eventId: string;
  eventDedupeKey: string;
  sequence: number;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface VentureSummary {
  ventureId: string;
  ventureName: string;
  ventureSlug: string;
  ventureClass: VentureClass;
  ventureLifecycleState: VentureLifecycleState;
  ventureStatus: VentureStatus;
  ownershipModel: VentureOwnershipModel;
  operatingMode: VentureOperatingMode;
  domainTags: string[];
  productTypeTags: string[];
  jurisdictionTags: string[];
}

export interface VentureProjection {
  ventureId: string;
  ventureName: string;
  ventureClass: VentureClass;
  ventureLifecycleState: VentureLifecycleState;
  ventureStatus: VentureStatus;
  ownershipModel: VentureOwnershipModel;
  operatingMode: VentureOperatingMode;
  originSummary: {
    originMissionIds: string[];
    linkedMissionPortfolioIds: string[];
    linkedEntityIds: string[];
  };
  linkedMissionIds: string[];
  linkedTeamIds: string[];
  limitations: string[];
  blockingReasons: string[];
  historyDigest: string;
  definition: VentureDefinition;
  validation: VentureValidationResult;
  history: {
    ventureId: string;
    entries: VentureHistoryEvent[];
  };
  summary: VentureSummary;
}

export interface VentureMaterializationSummary {
  ventureId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  linksPath: string;
  summaryPath: string;
}
