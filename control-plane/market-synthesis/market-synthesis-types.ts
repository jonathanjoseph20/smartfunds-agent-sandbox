export const MARKET_SYNTHESIS_LIFECYCLE_STATES = [
  'inactive',
  'initializing',
  'active',
  'progressing',
  'stabilizing',
  'completed'
] as const;

export const MARKET_SYNTHESIS_READINESS_STATES = [
  'pending',
  'analyzing',
  'coherent',
  'blocked'
] as const;

export const MARKET_SYNTHESIS_COMPLETION_STATES = [
  'completed',
  'incomplete',
  'inconclusive'
] as const;

export const MARKET_SYNTHESIS_HISTORY_EVENT_TYPES = [
  'market_synthesis_initialized',
  'cross_swarm_linked',
  'readiness_changed',
  'market_progressed',
  'market_stabilized',
  'market_completed',
  'market_marked_inconclusive'
] as const;

export type MarketSynthesisLifecycleState = typeof MARKET_SYNTHESIS_LIFECYCLE_STATES[number];
export type MarketSynthesisReadinessState = typeof MARKET_SYNTHESIS_READINESS_STATES[number];
export type MarketSynthesisCompletionState = typeof MARKET_SYNTHESIS_COMPLETION_STATES[number];
export type MarketSynthesisHistoryEventType = typeof MARKET_SYNTHESIS_HISTORY_EVENT_TYPES[number];

export interface MarketSynthesisDefinition {
  marketSynthesisId: string;
  displayName: string;
  synthesisType: string;
  enabled: boolean;
  crossSwarmMatchingRules: {
    eventFamilies?: string[];
    protocolFamilies?: string[];
    assetFamilies?: string[];
    responseFamilies?: string[];
  };
  scopeConstraints?: {
    minCrossSwarms?: number;
  };
}

export interface MarketSynthesisUnit {
  marketSynthesisId: string;
  displayName: string;
  synthesisType: string;
  enabled: boolean;
  linkedCrossSwarmIds: string[];
}

export interface LinkedCrossSwarmSummary {
  crossSwarmId: string;
  displayName: string;
  groupType: string;
  lifecycleState: MarketSynthesisLifecycleState;
  readinessState: MarketSynthesisReadinessState;
  completionSatisfied: boolean;
  unresolvedConflictCount: number;
  blockers: string[];
  conflicts: string[];
  protocolFamilies: string[];
  assetFamilies: string[];
  eventFamilies: string[];
  responseFamilies: string[];
}

export interface MarketSynthesisLinkProjection {
  marketSynthesisId: string;
  displayName: string;
  synthesisType: string;
  enabled: boolean;
  linkedCrossSwarmIds: string[];
  linkedCrossSwarms: LinkedCrossSwarmSummary[];
  rationale: string[];
}

export interface MarketSynthesisStatus {
  marketSynthesisId: string;
  lifecycleState: MarketSynthesisLifecycleState;
  readinessState: MarketSynthesisReadinessState;
  completionState: MarketSynthesisCompletionState;
  linkedCrossSwarmIds: string[];
  blockingReasons: string[];
  strengths: string[];
  limitations: string[];
}

export interface MarketSynthesisStatusProjection extends MarketSynthesisStatus {
  displayName: string;
  synthesisType: string;
  enabled: boolean;
  rationale: string[];
  linkedCrossSwarms: LinkedCrossSwarmSummary[];
}

export interface MarketSynthesisHistoryEntry {
  marketSynthesisId: string;
  eventType: MarketSynthesisHistoryEventType;
  linkedCrossSwarmIds?: string[];
  reason: string;
  slotReference?: string;
  eventDedupeKey: string;
}

export interface MarketSynthesisHistory {
  marketSynthesisId: string;
  entries: MarketSynthesisHistoryEntry[];
}

export interface MarketSynthesisProjection extends MarketSynthesisStatusProjection {
  historySummary: {
    totalEvents: number;
    lastEventType?: MarketSynthesisHistoryEventType;
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

export class MarketSynthesisError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MarketSynthesisError';
    this.code = code;
  }
}
