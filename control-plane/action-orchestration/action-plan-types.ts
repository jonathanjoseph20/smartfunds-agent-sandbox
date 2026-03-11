export const ACTION_PLAN_LIFECYCLE_STATES = [
  'inactive',
  'initializing',
  'active',
  'progressing',
  'stabilizing',
  'completed'
] as const;

export const ACTION_PLAN_READINESS_STATES = [
  'pending',
  'analyzing',
  'coherent',
  'blocked'
] as const;

export const ACTION_PLAN_COMPLETION_STATES = [
  'completed',
  'incomplete',
  'inconclusive'
] as const;

export const ACTION_PLAN_PRIORITIES = [
  'low',
  'normal',
  'high',
  'critical'
] as const;

export const ACTION_PLAN_ROUTE_SUMMARIES = [
  'monitor_bundle',
  'review_bundle',
  'escalate_bundle',
  'allocation_review_bundle'
] as const;

export const ACTION_PLAN_HISTORY_EVENT_TYPES = [
  'action_plan_initialized',
  'action_candidate_linked',
  'readiness_changed',
  'priority_changed',
  'plan_progressed',
  'plan_completed',
  'plan_marked_inconclusive'
] as const;

export type ActionPlanLifecycleState = typeof ACTION_PLAN_LIFECYCLE_STATES[number];
export type ActionPlanReadinessState = typeof ACTION_PLAN_READINESS_STATES[number];
export type ActionPlanCompletionState = typeof ACTION_PLAN_COMPLETION_STATES[number];
export type ActionPlanPriorityLevel = typeof ACTION_PLAN_PRIORITIES[number];
export type ActionPlanRouteSummaryCategory = typeof ACTION_PLAN_ROUTE_SUMMARIES[number];
export type ActionPlanHistoryEventType = typeof ACTION_PLAN_HISTORY_EVENT_TYPES[number];

export interface ActionPlanUnit {
  actionPlanId: string;
  displayName: string;
  planType: string;
  enabled: boolean;
}

export interface ActionPlanStatus {
  actionPlanId: string;
  lifecycleState:
    | 'inactive'
    | 'initializing'
    | 'active'
    | 'progressing'
    | 'stabilizing'
    | 'completed';

  readinessState:
    | 'pending'
    | 'analyzing'
    | 'coherent'
    | 'blocked';

  completionState:
    | 'completed'
    | 'incomplete'
    | 'inconclusive';

  priority:
    | 'low'
    | 'normal'
    | 'high'
    | 'critical';

  routeSummary:
    | 'monitor_bundle'
    | 'review_bundle'
    | 'escalate_bundle'
    | 'allocation_review_bundle';

  linkedActionIds: string[];

  blockingReasons: string[];

  strengths: string[];

  limitations: string[];
}

export interface ActionPlanHistoryEntry {
  actionPlanId: string;
  eventType:
    | 'action_plan_initialized'
    | 'action_candidate_linked'
    | 'readiness_changed'
    | 'priority_changed'
    | 'plan_progressed'
    | 'plan_completed'
    | 'plan_marked_inconclusive';

  linkedActionIds?: string[];
  reason: string;
  slotReference?: string;
}

export interface ActionPlanDefinition {
  actionPlanId: string;
  displayName: string;
  planType: string;
  enabled: boolean;
  matchingRules: {
    routeCategories?: string[];
    riskThemes?: string[];
  };
}

export interface LinkedActionCandidate {
  actionId: string;
  displayName: string;
  actionType: string;
  enabled: boolean;
  lifecycleState: ActionPlanLifecycleState;
  readinessState: ActionPlanReadinessState;
  completionState: ActionPlanCompletionState;
  priority: ActionPlanPriorityLevel;
  routeCategory: string;
  riskThemes: string[];
  blockingReasons: string[];
  strengths: string[];
  limitations: string[];
}

export interface ActionPlanLink {
  actionPlanId: string;
  linkedActionIds: string[];
  linkedActions: LinkedActionCandidate[];
  riskThemes: string[];
  routeCategories: string[];
  rationale: string[];
}

export interface ActionPlanPriorityEvaluation {
  actionPlanId: string;
  priority: ActionPlanPriorityLevel;
  reasons: string[];
}

export interface ActionPlanRouteSummaryEvaluation {
  actionPlanId: string;
  routeSummary: ActionPlanRouteSummaryCategory;
  reasons: string[];
}

export interface ActionPlanStatusProjection extends ActionPlanStatus {
  displayName: string;
  planType: string;
  enabled: boolean;
  linkedActions: LinkedActionCandidate[];
  rationale: string[];
  priorityReasons: string[];
  routeSummaryReasons: string[];
}

export interface ActionPlanHistory {
  actionPlanId: string;
  entries: ActionPlanHistoryEntry[];
}

export interface ActionPlanProjection extends ActionPlanStatusProjection {
  historySummary: {
    totalEvents: number;
    lastEventType?: ActionPlanHistoryEventType;
  };
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    historyJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}

export class ActionPlanError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ActionPlanError';
    this.code = code;
  }
}
