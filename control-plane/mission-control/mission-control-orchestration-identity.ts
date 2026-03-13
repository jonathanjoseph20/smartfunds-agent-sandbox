import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionControlOrchestrationActionClass,
  MissionControlOrchestrationHistoryEventType,
  MissionControlOrchestrationPriority,
  MissionControlOrchestrationQueueState,
  SystemicStabilizationStrategyClass,
} from './mission-control-orchestration-types.ts';

export function uniqueSortedStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeCanonicalRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

export function deriveMissionControlInterventionPlanId(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  strategyClass: SystemicStabilizationStrategyClass;
  portfolioIds: string[];
  systemicBlockingClusterIds?: string[];
  escalationPatternIds?: string[];
}): string {
  return sha256(canonicalStringify({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    strategyClass: input.strategyClass,
    portfolioIds: uniqueSortedStrings(input.portfolioIds),
    systemicBlockingClusterIds: uniqueSortedStrings(input.systemicBlockingClusterIds),
    escalationPatternIds: uniqueSortedStrings(input.escalationPatternIds),
  }));
}

export function deriveSystemicStabilizationStrategyId(input: {
  missionControlInterventionPlanId: string;
  strategyClass: SystemicStabilizationStrategyClass;
  reasonTokens?: string[];
  linkedDependencyIds?: string[];
  linkedBlockingClusterIds?: string[];
  linkedEscalationPatternIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    strategyClass: input.strategyClass,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    linkedDependencyIds: uniqueSortedStrings(input.linkedDependencyIds),
    linkedBlockingClusterIds: uniqueSortedStrings(input.linkedBlockingClusterIds),
    linkedEscalationPatternIds: uniqueSortedStrings(input.linkedEscalationPatternIds),
  }));
}

export function deriveMissionControlOrchestrationActionItemId(input: {
  missionControlInterventionPlanId: string;
  actionClass: MissionControlOrchestrationActionClass;
  priority: MissionControlOrchestrationPriority;
  reasonTokens?: string[];
  linkedPortfolioIds?: string[];
  linkedRequirementIds?: string[];
  linkedEscalationPatternIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    actionClass: input.actionClass,
    priority: input.priority,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    linkedPortfolioIds: uniqueSortedStrings(input.linkedPortfolioIds),
    linkedRequirementIds: uniqueSortedStrings(input.linkedRequirementIds),
    linkedEscalationPatternIds: uniqueSortedStrings(input.linkedEscalationPatternIds),
  }));
}

export function deriveMissionControlOrchestrationQueueEntryId(input: {
  missionControlInterventionPlanId: string;
  priority: MissionControlOrchestrationPriority;
  queueState: MissionControlOrchestrationQueueState;
  reasonTokens?: string[];
  linkedPortfolioIds?: string[];
  linkedBlockingClusterIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    priority: input.priority,
    queueState: input.queueState,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    linkedPortfolioIds: uniqueSortedStrings(input.linkedPortfolioIds),
    linkedBlockingClusterIds: uniqueSortedStrings(input.linkedBlockingClusterIds),
  }));
}

export function deriveMissionControlOrchestrationHistoryEventDedupeKey(input: {
  missionControlInterventionPlanId: string;
  eventType: MissionControlOrchestrationHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    eventType: input.eventType,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    payload: normalizeCanonicalRecord(input.payload),
  }));
}
