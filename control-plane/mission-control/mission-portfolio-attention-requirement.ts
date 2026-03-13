import { deriveMissionPortfolioAttentionRequirementId } from './mission-portfolio-attention-identity.ts';
import type {
  MissionPortfolioAttentionRequirement,
  MissionPortfolioEscalationSeverity,
} from './mission-portfolio-attention-types.ts';
import type { MissionPortfolioProjection } from './mission-portfolio-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function severityRank(severity: MissionPortfolioEscalationSeverity): number {
  if (severity === 'critical') {
    return 4;
  }
  if (severity === 'high') {
    return 3;
  }
  if (severity === 'medium') {
    return 2;
  }
  return 1;
}

function pushRequirement(input: {
  requirements: MissionPortfolioAttentionRequirement[];
  missionPortfolioId: string;
  requirementClass: MissionPortfolioAttentionRequirement['requirementClass'];
  severity: MissionPortfolioEscalationSeverity;
  reasonTokens: string[];
  linkedBlockingClusterIds?: string[];
  linkedMissionRunIds?: string[];
  linkedDecisionIds?: string[];
  state?: MissionPortfolioAttentionRequirement['state'];
}): void {
  const reasonTokens = uniqueSorted(input.reasonTokens);
  const linkedBlockingClusterIds = uniqueSorted(input.linkedBlockingClusterIds ?? []);
  const linkedMissionRunIds = uniqueSorted(input.linkedMissionRunIds ?? []);
  const linkedDecisionIds = uniqueSorted(input.linkedDecisionIds ?? []);
  const state = input.state ?? 'active';

  input.requirements.push({
    portfolioAttentionRequirementId: deriveMissionPortfolioAttentionRequirementId({
      missionPortfolioId: input.missionPortfolioId,
      requirementClass: input.requirementClass,
      severity: input.severity,
      reasonTokens,
      linkedBlockingClusterIds,
      linkedMissionRunIds,
      linkedDecisionIds,
    }),
    missionPortfolioId: input.missionPortfolioId,
    requirementClass: input.requirementClass,
    severity: input.severity,
    reasonTokens,
    linkedBlockingClusterIds,
    linkedMissionRunIds,
    linkedDecisionIds,
    state,
  });
}

export function deriveMissionPortfolioAttentionRequirements(input: {
  portfolio: MissionPortfolioProjection;
  forceAttentionRequested: boolean;
}): MissionPortfolioAttentionRequirement[] {
  const requirements: MissionPortfolioAttentionRequirement[] = [];

  const activeBlockingClusters = input.portfolio.blockingClusters
    .filter((entry) => entry.state === 'active')
    .sort((left, right) => left.portfolioBlockingClusterId.localeCompare(right.portfolioBlockingClusterId));

  if (activeBlockingClusters.length > 0) {
    const highestSeverity = activeBlockingClusters
      .map((entry) => entry.severity)
      .sort((left, right) => severityRank(right) - severityRank(left))[0] ?? 'medium';

    pushRequirement({
      requirements,
      missionPortfolioId: input.portfolio.missionPortfolioId,
      requirementClass: 'critical_blocking_cluster',
      severity: highestSeverity === 'critical' ? 'critical' : 'high',
      reasonTokens: uniqueSorted([
        'blocking_cluster_present',
        ...activeBlockingClusters.map((entry) => `cluster:${entry.portfolioBlockingClusterId}`),
      ]),
      linkedBlockingClusterIds: activeBlockingClusters.map((entry) => entry.portfolioBlockingClusterId),
      linkedMissionRunIds: uniqueSorted(activeBlockingClusters.flatMap((entry) => entry.blockedMissionRunIds)),
    });
  }

  if (input.portfolio.governancePosture === 'mixed' || input.portfolio.governancePosture === 'decision_blocked') {
    pushRequirement({
      requirements,
      missionPortfolioId: input.portfolio.missionPortfolioId,
      requirementClass: 'governance_mixed_attention',
      severity: input.portfolio.governancePosture === 'decision_blocked' ? 'critical' : 'high',
      reasonTokens: [
        `governance:${input.portfolio.governancePosture}`,
      ],
      linkedMissionRunIds: uniqueSorted(input.portfolio.linkedDecisionSummaries.map((entry) => entry.missionRunId)),
      linkedDecisionIds: uniqueSorted(input.portfolio.linkedDecisionSummaries.map((entry) => entry.decisionRecordId)),
    });
  }

  if (input.portfolio.priorityDistribution.posture === 'critical_overload') {
    pushRequirement({
      requirements,
      missionPortfolioId: input.portfolio.missionPortfolioId,
      requirementClass: 'critical_priority_attention',
      severity: 'critical',
      reasonTokens: [
        `priority_posture:${input.portfolio.priorityDistribution.posture}`,
        `critical_mission_count:${String(input.portfolio.priorityDistribution.criticalMissionCount)}`,
      ],
      linkedMissionRunIds: [...input.portfolio.missionRunIds],
    });
  }

  if (input.portfolio.healthState === 'degraded' || input.portfolio.healthState === 'unstable' || input.portfolio.healthState === 'blocked') {
    pushRequirement({
      requirements,
      missionPortfolioId: input.portfolio.missionPortfolioId,
      requirementClass: 'degraded_health_attention',
      severity: input.portfolio.healthState === 'blocked' ? 'high' : 'medium',
      reasonTokens: [
        `health:${input.portfolio.healthState}`,
      ],
      linkedMissionRunIds: [...input.portfolio.missionRunIds],
    });
  }

  if (input.portfolio.healthState === 'failed') {
    pushRequirement({
      requirements,
      missionPortfolioId: input.portfolio.missionPortfolioId,
      requirementClass: 'failed_member_attention',
      severity: 'critical',
      reasonTokens: [
        'portfolio_contains_failed_member',
        `health:${input.portfolio.healthState}`,
      ],
      linkedMissionRunIds: [...input.portfolio.missionRunIds],
    });
  }

  if (input.forceAttentionRequested) {
    pushRequirement({
      requirements,
      missionPortfolioId: input.portfolio.missionPortfolioId,
      requirementClass: 'operator_forced_attention',
      severity: 'high',
      reasonTokens: ['operator_forced_attention_recorded'],
      linkedMissionRunIds: [...input.portfolio.missionRunIds],
    });
  }

  if (
    input.portfolio.readinessState === 'inconclusive'
    || input.portfolio.healthState === 'inconclusive'
    || input.portfolio.governancePosture === 'inconclusive'
  ) {
    pushRequirement({
      requirements,
      missionPortfolioId: input.portfolio.missionPortfolioId,
      requirementClass: 'inconclusive_attention',
      severity: 'medium',
      reasonTokens: uniqueSorted([
        `readiness:${input.portfolio.readinessState}`,
        `health:${input.portfolio.healthState}`,
        `governance:${input.portfolio.governancePosture}`,
      ]),
      linkedMissionRunIds: [...input.portfolio.missionRunIds],
      state: 'inconclusive',
    });
  }

  const deduped = new Map<string, MissionPortfolioAttentionRequirement>();
  for (const requirement of requirements) {
    deduped.set(requirement.portfolioAttentionRequirementId, requirement);
  }

  return [...deduped.values()].sort((left, right) => {
    const bySeverity = severityRank(right.severity) - severityRank(left.severity);
    if (bySeverity !== 0) {
      return bySeverity;
    }

    const byClass = left.requirementClass.localeCompare(right.requirementClass);
    if (byClass !== 0) {
      return byClass;
    }

    return left.portfolioAttentionRequirementId.localeCompare(right.portfolioAttentionRequirementId);
  });
}
