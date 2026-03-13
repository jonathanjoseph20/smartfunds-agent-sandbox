import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionPortfolioResolutionActionType,
  MissionPortfolioResolutionHistoryEventType,
} from './mission-portfolio-resolution-types.ts';

export function uniqueSortedStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeCanonicalRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

export function deriveMissionPortfolioStabilizationId(input: {
  missionPortfolioId: string;
  stabilizationStatus: string;
  reasonTokens?: string[];
  linkedAttentionRequirementIds?: string[];
  linkedEscalationIds?: string[];
  linkedBlockingClusterIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    stabilizationStatus: input.stabilizationStatus,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    linkedAttentionRequirementIds: uniqueSortedStrings(input.linkedAttentionRequirementIds),
    linkedEscalationIds: uniqueSortedStrings(input.linkedEscalationIds),
    linkedBlockingClusterIds: uniqueSortedStrings(input.linkedBlockingClusterIds),
  }));
}

export function deriveMissionPortfolioResolutionStatusId(input: {
  missionPortfolioId: string;
  resolutionStatus: string;
  reasonTokens?: string[];
  linkedActionRecordIds?: string[];
  linkedRequirementIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    resolutionStatus: input.resolutionStatus,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    linkedActionRecordIds: uniqueSortedStrings(input.linkedActionRecordIds),
    linkedRequirementIds: uniqueSortedStrings(input.linkedRequirementIds),
  }));
}

export function deriveMissionPortfolioClosureEligibilityId(input: {
  missionPortfolioId: string;
  closureEligibility: string;
  reasonTokens?: string[];
  unresolvedRequirementCount: number;
  openEscalationCount: number;
  blockingClusterCount: number;
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    closureEligibility: input.closureEligibility,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    unresolvedRequirementCount: input.unresolvedRequirementCount,
    openEscalationCount: input.openEscalationCount,
    blockingClusterCount: input.blockingClusterCount,
  }));
}

export function deriveMissionPortfolioResolutionQueueEntryId(input: {
  missionPortfolioId: string;
  resolutionStatus: string;
  closureEligibility: string;
  queueCycle: number;
  priority: number;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    resolutionStatus: input.resolutionStatus,
    closureEligibility: input.closureEligibility,
    queueCycle: input.queueCycle,
    priority: input.priority,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function derivePortfolioResolutionActionRecordId(input: {
  missionPortfolioId: string;
  portfolioResolutionQueueEntryId: string;
  actionType: MissionPortfolioResolutionActionType;
  actionOutcome: string;
  reasonTokens?: string[];
  linkedRequirementIds?: string[];
  linkedEscalationIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    portfolioResolutionQueueEntryId: input.portfolioResolutionQueueEntryId,
    actionType: input.actionType,
    actionOutcome: input.actionOutcome,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    linkedRequirementIds: uniqueSortedStrings(input.linkedRequirementIds),
    linkedEscalationIds: uniqueSortedStrings(input.linkedEscalationIds),
  }));
}

export function deriveMissionPortfolioResolutionHistoryEventDedupeKey(input: {
  missionPortfolioId: string;
  eventType: MissionPortfolioResolutionHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    eventType: input.eventType,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    payload: normalizeCanonicalRecord(input.payload),
  }));
}
