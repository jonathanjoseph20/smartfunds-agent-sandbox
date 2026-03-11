export const PORTFOLIO_LIFECYCLE_STATES = [
  'inactive',
  'initializing',
  'active',
  'progressing',
  'stabilizing',
  'completed'
] as const;

export const PORTFOLIO_READINESS_STATES = [
  'pending',
  'analyzing',
  'coherent',
  'blocked'
] as const;

export const PORTFOLIO_COMPLETION_STATES = [
  'completed',
  'incomplete',
  'inconclusive'
] as const;

export const PORTFOLIO_HISTORY_EVENT_TYPES = [
  'portfolio_initialized',
  'market_synthesis_linked',
  'readiness_changed',
  'portfolio_progressed',
  'portfolio_stabilized',
  'portfolio_completed',
  'portfolio_marked_inconclusive'
] as const;

export type PortfolioLifecycleState = typeof PORTFOLIO_LIFECYCLE_STATES[number];
export type PortfolioReadinessState = typeof PORTFOLIO_READINESS_STATES[number];
export type PortfolioCompletionState = typeof PORTFOLIO_COMPLETION_STATES[number];
export type PortfolioHistoryEventType = typeof PORTFOLIO_HISTORY_EVENT_TYPES[number];

export interface PortfolioIntelligenceUnit {
  portfolioId: string;
  displayName: string;
  portfolioType: string;
  enabled: boolean;
  linkedMarketSynthesisIds: string[];
}

export interface PortfolioDefinition {
  portfolioId: string;
  displayName: string;
  portfolioType: string;
  enabled: boolean;
  matchingRules: {
    protocolFamilies?: string[];
    assetFamilies?: string[];
    eventFamilies?: string[];
    synthesisTypes?: string[];
    marketSynthesisIds?: string[];
  };
  readinessRules?: {
    requireAllLinkedSynthesesReady?: boolean;
  };
}

export interface LinkedMarketSynthesisSummary {
  marketSynthesisId: string;
  displayName: string;
  synthesisType: string;
  lifecycleState: PortfolioLifecycleState;
  readinessState: PortfolioReadinessState;
  completionState: PortfolioCompletionState;
  blockingReasons: string[];
  limitations: string[];
  rationale: string[];
  protocolFamilies: string[];
  assetFamilies: string[];
  eventFamilies: string[];
}

export interface PortfolioLinkResult {
  portfolioId: string;
  linkedMarketSynthesisIds: string[];
  rationale: string[];
  linkedMarketSyntheses: LinkedMarketSynthesisSummary[];
}

export interface PortfolioIntelligenceStatus {
  portfolioId: string;
  lifecycleState: PortfolioLifecycleState;
  readinessState: PortfolioReadinessState;
  completionState: PortfolioCompletionState;
  linkedMarketSynthesisIds: string[];
  blockingReasons: string[];
  strengths: string[];
  limitations: string[];
  riskThemes: string[];
  exposureFlags: string[];
  concentrationWarnings: string[];
}

export interface PortfolioIntelligenceStatusProjection extends PortfolioIntelligenceStatus {
  displayName: string;
  portfolioType: string;
  enabled: boolean;
  rationale: string[];
  linkedMarketSyntheses: LinkedMarketSynthesisSummary[];
}

export interface PortfolioRiskSurface {
  portfolioId: string;
  riskThemes: string[];
  exposureFlags: string[];
  concentrationWarnings: string[];
}

export interface PortfolioIntelligenceHistoryEntry {
  portfolioId: string;
  eventType: PortfolioHistoryEventType;
  linkedMarketSynthesisIds?: string[];
  reason: string;
  slotReference?: string;
  eventDedupeKey: string;
}

export interface PortfolioIntelligenceHistory {
  portfolioId: string;
  entries: PortfolioIntelligenceHistoryEntry[];
}

export interface PortfolioIntelligenceProjection extends PortfolioIntelligenceStatusProjection {
  historySummary: {
    totalEvents: number;
    lastEventType?: PortfolioHistoryEventType;
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

export class PortfolioIntelligenceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PortfolioIntelligenceError';
    this.code = code;
  }
}
