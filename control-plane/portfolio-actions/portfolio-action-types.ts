export const PORTFOLIO_ACTION_LIFECYCLE_STATES = [
  'inactive',
  'initializing',
  'active',
  'progressing',
  'stabilizing',
  'completed'
] as const;

export const PORTFOLIO_ACTION_READINESS_STATES = [
  'pending',
  'analyzing',
  'ready',
  'blocked'
] as const;

export const PORTFOLIO_ACTION_COMPLETION_STATES = [
  'completed',
  'incomplete',
  'inconclusive'
] as const;

export const PORTFOLIO_ACTION_PRIORITIES = [
  'low',
  'normal',
  'high',
  'critical'
] as const;

export const PORTFOLIO_ACTION_ROUTE_CATEGORIES = [
  'monitor',
  'review',
  'escalate',
  'prepare_allocation_review'
] as const;

export const PORTFOLIO_ACTION_HISTORY_EVENT_TYPES = [
  'action_initialized',
  'portfolio_linked',
  'readiness_changed',
  'priority_changed',
  'action_progressed',
  'action_completed',
  'action_marked_inconclusive'
] as const;

export type PortfolioActionLifecycleState = typeof PORTFOLIO_ACTION_LIFECYCLE_STATES[number];
export type PortfolioActionReadinessState = typeof PORTFOLIO_ACTION_READINESS_STATES[number];
export type PortfolioActionCompletionState = typeof PORTFOLIO_ACTION_COMPLETION_STATES[number];
export type PortfolioActionPriority = typeof PORTFOLIO_ACTION_PRIORITIES[number];
export type PortfolioActionRouteCategory = typeof PORTFOLIO_ACTION_ROUTE_CATEGORIES[number];
export type PortfolioActionHistoryEventType = typeof PORTFOLIO_ACTION_HISTORY_EVENT_TYPES[number];

export interface PortfolioActionDefinition {
  actionId: string;
  displayName: string;
  actionType: string;
  enabled: boolean;
  portfolioMatchRules: {
    riskThemes?: string[];
    exposureFlags?: string[];
    concentrationWarnings?: string[];
    marketEventFamilies?: string[];
  };
  readinessRules?: string[];
  blockingRules?: string[];
  priorityRules?: string[];
}

export interface LinkedPortfolioSummary {
  portfolioId: string;
  displayName: string;
  portfolioType: string;
  lifecycleState: PortfolioActionLifecycleState;
  readinessState: 'pending' | 'analyzing' | 'coherent' | 'blocked';
  completionState: PortfolioActionCompletionState;
  blockingReasons: string[];
  limitations: string[];
  riskThemes: string[];
  exposureFlags: string[];
  concentrationWarnings: string[];
}

export interface LinkedPortfolioActionUnit {
  actionId: string;
  linkedPortfolioIds: string[];
  linkedPortfolios: LinkedPortfolioSummary[];
  riskThemes: string[];
  exposureFlags: string[];
  concentrationWarnings: string[];
  rationale: string[];
}

export interface PortfolioActionReadinessEvaluation {
  actionId: string;
  readinessState: PortfolioActionReadinessState;
  blockingReasons: string[];
  strengths: string[];
  limitations: string[];
}

export interface PortfolioActionCompletionEvaluation {
  actionId: string;
  completionState: PortfolioActionCompletionState;
  limitations: string[];
}

export interface PortfolioActionPriorityEvaluation {
  actionId: string;
  priority: PortfolioActionPriority;
  reasons: string[];
  routeCategory: PortfolioActionRouteCategory;
}

export interface PortfolioActionStatus {
  actionId: string;
  lifecycleState: PortfolioActionLifecycleState;
  readinessState: PortfolioActionReadinessState;
  completionState: PortfolioActionCompletionState;
  priority: PortfolioActionPriority;
  routeCategory: PortfolioActionRouteCategory;
  linkedPortfolioIds: string[];
  blockingReasons: string[];
  riskThemes: string[];
  strengths: string[];
  limitations: string[];
}

export interface PortfolioActionStatusProjection extends PortfolioActionStatus {
  displayName: string;
  actionType: string;
  enabled: boolean;
  rationale: string[];
  linkedPortfolios: LinkedPortfolioSummary[];
  exposureFlags: string[];
  concentrationWarnings: string[];
  priorityReasons: string[];
}

export interface PortfolioActionHistoryEntry {
  actionId: string;
  eventType: PortfolioActionHistoryEventType;
  reason: string;
  linkedPortfolioIds: string[];
  readinessState: PortfolioActionReadinessState;
  completionState: PortfolioActionCompletionState;
  priority: PortfolioActionPriority;
  routeCategory: PortfolioActionRouteCategory;
  eventDedupeKey: string;
  slotReference?: string;
}

export interface PortfolioActionHistory {
  actionId: string;
  entries: PortfolioActionHistoryEntry[];
}

export interface PortfolioActionProjection extends PortfolioActionStatusProjection {
  historySummary: {
    totalEvents: number;
    lastEventType?: PortfolioActionHistoryEventType;
    lastEventDedupeKey?: string;
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

export class PortfolioActionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PortfolioActionError';
    this.code = code;
  }
}
