import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionPortfolioActionType,
  MissionPortfolioAttentionHistoryEventType,
  MissionPortfolioAttentionRequirementClass,
  MissionPortfolioEscalationClass,
} from './mission-portfolio-attention-types.ts';

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function deriveMissionPortfolioAttentionRequirementId(input: {
  missionPortfolioId: string;
  requirementClass: MissionPortfolioAttentionRequirementClass;
  severity: string;
  reasonTokens?: string[];
  linkedBlockingClusterIds?: string[];
  linkedMissionRunIds?: string[];
  linkedDecisionIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    requirementClass: input.requirementClass,
    severity: input.severity,
    reasonTokens: uniqueSorted(input.reasonTokens),
    linkedBlockingClusterIds: uniqueSorted(input.linkedBlockingClusterIds),
    linkedMissionRunIds: uniqueSorted(input.linkedMissionRunIds),
    linkedDecisionIds: uniqueSorted(input.linkedDecisionIds),
  }));
}

export function deriveMissionPortfolioEscalationId(input: {
  missionPortfolioId: string;
  escalationClass: MissionPortfolioEscalationClass;
  severity: string;
  reasonTokens?: string[];
  linkedRequirementIds?: string[];
  linkedMissionRunIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    escalationClass: input.escalationClass,
    severity: input.severity,
    reasonTokens: uniqueSorted(input.reasonTokens),
    linkedRequirementIds: uniqueSorted(input.linkedRequirementIds),
    linkedMissionRunIds: uniqueSorted(input.linkedMissionRunIds),
  }));
}

export function deriveMissionPortfolioAttentionQueueEntryId(input: {
  missionPortfolioId: string;
  requirementClass: MissionPortfolioAttentionRequirementClass;
  escalationClass: MissionPortfolioEscalationClass | null;
  queueCycle: number;
  priority: number;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    requirementClass: input.requirementClass,
    escalationClass: input.escalationClass,
    queueCycle: input.queueCycle,
    priority: input.priority,
    reasonTokens: uniqueSorted(input.reasonTokens),
  }));
}

export function derivePortfolioOperatorActionRecordId(input: {
  missionPortfolioId: string;
  portfolioAttentionQueueEntryId: string;
  actionType: MissionPortfolioActionType;
  actionOutcome: string;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedRequirementIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    portfolioAttentionQueueEntryId: input.portfolioAttentionQueueEntryId,
    actionType: input.actionType,
    actionOutcome: input.actionOutcome,
    reasonTokens: uniqueSorted(input.reasonTokens),
    linkedEscalationIds: uniqueSorted(input.linkedEscalationIds),
    linkedRequirementIds: uniqueSorted(input.linkedRequirementIds),
  }));
}

export function deriveMissionPortfolioAttentionHistoryEventDedupeKey(input: {
  missionPortfolioId: string;
  eventType: MissionPortfolioAttentionHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    eventType: input.eventType,
    reasonTokens: uniqueSorted(input.reasonTokens),
    payload: JSON.parse(canonicalStringify(input.payload)) as Record<string, unknown>,
  }));
}
