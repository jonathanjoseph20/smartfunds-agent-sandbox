import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  CrossPortfolioEscalationPatternClass,
  CrossPortfolioIntelligenceHistoryEventType,
  CrossPortfolioMissionIntelligenceSetType,
  CrossPortfolioSharedDependencyClass,
  SystemicBlockingClusterSeverity,
} from './cross-portfolio-mission-intelligence-types.ts';

export function uniqueSortedStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeCanonicalRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

export function deriveCrossPortfolioMissionIntelligenceSetId(input: {
  setType: CrossPortfolioMissionIntelligenceSetType;
  portfolioIds: string[];
}): string {
  return sha256(canonicalStringify({
    setType: input.setType,
    portfolioIds: uniqueSortedStrings(input.portfolioIds),
  }));
}

export function deriveCrossPortfolioSharedDependencyId(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioIds: string[];
  dependencyClass: CrossPortfolioSharedDependencyClass;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    portfolioIds: uniqueSortedStrings(input.portfolioIds),
    dependencyClass: input.dependencyClass,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveSystemicBlockingClusterId(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioIds: string[];
  portfolioBlockingClusterIds?: string[];
  severity: SystemicBlockingClusterSeverity;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    portfolioIds: uniqueSortedStrings(input.portfolioIds),
    portfolioBlockingClusterIds: uniqueSortedStrings(input.portfolioBlockingClusterIds),
    severity: input.severity,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveCrossPortfolioEscalationPatternId(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioIds: string[];
  patternClass: CrossPortfolioEscalationPatternClass;
  severity: SystemicBlockingClusterSeverity;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    portfolioIds: uniqueSortedStrings(input.portfolioIds),
    patternClass: input.patternClass,
    severity: input.severity,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveCrossPortfolioIntelligenceHistoryEventDedupeKey(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  eventType: CrossPortfolioIntelligenceHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    eventType: input.eventType,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    payload: normalizeCanonicalRecord(input.payload),
  }));
}
