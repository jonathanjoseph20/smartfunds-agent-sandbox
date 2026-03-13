import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionPortfolioHistoryEventType,
  MissionPortfolioMembershipClass,
  MissionPortfolioType,
} from './mission-portfolio-types.ts';

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function deriveMissionPortfolioId(input: {
  portfolioType: MissionPortfolioType;
  scopeKey: string;
}): string {
  return sha256(canonicalStringify({
    portfolioType: input.portfolioType,
    scopeKey: input.scopeKey,
  }));
}

export function deriveMissionPortfolioMembershipId(input: {
  missionPortfolioId: string;
  missionRunId: string;
  membershipClass: MissionPortfolioMembershipClass;
  reasonTokens?: string[];
  state?: 'active' | 'inactive';
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    missionRunId: input.missionRunId,
    membershipClass: input.membershipClass,
    reasonTokens: uniqueSorted(input.reasonTokens),
    state: input.state ?? 'active',
  }));
}

export function derivePortfolioBlockingClusterId(input: {
  missionPortfolioId: string;
  blockingMissionRunIds: string[];
  blockedMissionRunIds: string[];
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    missionPortfolioId: input.missionPortfolioId,
    blockingMissionRunIds: uniqueSorted(input.blockingMissionRunIds),
    blockedMissionRunIds: uniqueSorted(input.blockedMissionRunIds),
    reasonTokens: uniqueSorted(input.reasonTokens),
  }));
}

export function deriveMissionPortfolioHistoryEventDedupeKey(input: {
  missionPortfolioId: string;
  eventType: MissionPortfolioHistoryEventType;
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
