import { deriveMissionPortfolioEscalationId } from './mission-portfolio-attention-identity.ts';
import type {
  MissionPortfolioAttentionRequirement,
  MissionPortfolioEscalation,
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

function highestSeverity(values: MissionPortfolioEscalationSeverity[]): MissionPortfolioEscalationSeverity {
  return [...values].sort((left, right) => severityRank(right) - severityRank(left))[0] ?? 'low';
}

function collectRequirements(
  requirements: MissionPortfolioAttentionRequirement[],
  classes: MissionPortfolioAttentionRequirement['requirementClass'][]
): MissionPortfolioAttentionRequirement[] {
  const classSet = new Set(classes);
  return requirements.filter((entry) => classSet.has(entry.requirementClass));
}

function createEscalation(input: {
  missionPortfolioId: string;
  escalationClass: MissionPortfolioEscalation['escalationClass'];
  severity: MissionPortfolioEscalationSeverity;
  reasonTokens: string[];
  requirements: MissionPortfolioAttentionRequirement[];
  state?: MissionPortfolioEscalation['state'];
}): MissionPortfolioEscalation {
  const linkedRequirementIds = uniqueSorted(input.requirements.map((entry) => entry.portfolioAttentionRequirementId));
  const linkedMissionRunIds = uniqueSorted(input.requirements.flatMap((entry) => entry.linkedMissionRunIds));
  const reasonTokens = uniqueSorted(input.reasonTokens);

  return {
    portfolioEscalationId: deriveMissionPortfolioEscalationId({
      missionPortfolioId: input.missionPortfolioId,
      escalationClass: input.escalationClass,
      severity: input.severity,
      reasonTokens,
      linkedRequirementIds,
      linkedMissionRunIds,
    }),
    missionPortfolioId: input.missionPortfolioId,
    escalationClass: input.escalationClass,
    severity: input.severity,
    reasonTokens,
    linkedRequirementIds,
    linkedMissionRunIds,
    state: input.state ?? 'open',
  };
}

export function deriveMissionPortfolioEscalations(input: {
  portfolio: MissionPortfolioProjection;
  requirements: MissionPortfolioAttentionRequirement[];
}): MissionPortfolioEscalation[] {
  const escalations: MissionPortfolioEscalation[] = [];

  const blockedRequirements = collectRequirements(input.requirements, ['critical_blocking_cluster']);
  if (blockedRequirements.length > 0 || input.portfolio.readinessState === 'blocked') {
    escalations.push(createEscalation({
      missionPortfolioId: input.portfolio.missionPortfolioId,
      escalationClass: 'portfolio_blocked',
      severity: highestSeverity([
        ...blockedRequirements.map((entry) => entry.severity),
        input.portfolio.readinessState === 'blocked' ? 'critical' : 'medium',
      ]),
      reasonTokens: uniqueSorted([
        `readiness:${input.portfolio.readinessState}`,
        ...blockedRequirements.flatMap((entry) => entry.reasonTokens),
      ]),
      requirements: blockedRequirements,
    }));
  }

  const unstableRequirements = collectRequirements(input.requirements, ['degraded_health_attention', 'failed_member_attention']);
  if (unstableRequirements.length > 0 || input.portfolio.healthState === 'unstable' || input.portfolio.healthState === 'failed') {
    escalations.push(createEscalation({
      missionPortfolioId: input.portfolio.missionPortfolioId,
      escalationClass: 'portfolio_unstable',
      severity: highestSeverity([
        ...unstableRequirements.map((entry) => entry.severity),
        input.portfolio.healthState === 'failed' ? 'critical' : 'high',
      ]),
      reasonTokens: uniqueSorted([
        `health:${input.portfolio.healthState}`,
        ...unstableRequirements.flatMap((entry) => entry.reasonTokens),
      ]),
      requirements: unstableRequirements,
    }));
  }

  const governanceRequirements = collectRequirements(input.requirements, ['governance_mixed_attention']);
  if (governanceRequirements.length > 0 || input.portfolio.governancePosture === 'decision_blocked') {
    escalations.push(createEscalation({
      missionPortfolioId: input.portfolio.missionPortfolioId,
      escalationClass: 'portfolio_governance_blocked',
      severity: input.portfolio.governancePosture === 'decision_blocked' ? 'critical' : 'high',
      reasonTokens: uniqueSorted([
        `governance:${input.portfolio.governancePosture}`,
        ...governanceRequirements.flatMap((entry) => entry.reasonTokens),
      ]),
      requirements: governanceRequirements,
    }));
  }

  const criticalPriorityRequirements = collectRequirements(input.requirements, ['critical_priority_attention']);
  if (criticalPriorityRequirements.length > 0 || input.portfolio.priorityDistribution.posture === 'critical_overload') {
    escalations.push(createEscalation({
      missionPortfolioId: input.portfolio.missionPortfolioId,
      escalationClass: 'portfolio_critical_overload',
      severity: 'critical',
      reasonTokens: uniqueSorted([
        `priority_posture:${input.portfolio.priorityDistribution.posture}`,
        ...criticalPriorityRequirements.flatMap((entry) => entry.reasonTokens),
      ]),
      requirements: criticalPriorityRequirements,
    }));
  }

  if (input.portfolio.priorityDistribution.posture === 'priority_skewed') {
    escalations.push(createEscalation({
      missionPortfolioId: input.portfolio.missionPortfolioId,
      escalationClass: 'portfolio_priority_conflict',
      severity: 'high',
      reasonTokens: ['priority_posture:priority_skewed'],
      requirements: criticalPriorityRequirements,
    }));
  }

  const inconclusiveRequirements = collectRequirements(input.requirements, ['inconclusive_attention']);
  if (inconclusiveRequirements.length > 0) {
    escalations.push(createEscalation({
      missionPortfolioId: input.portfolio.missionPortfolioId,
      escalationClass: 'portfolio_inconclusive',
      severity: 'medium',
      reasonTokens: uniqueSorted(inconclusiveRequirements.flatMap((entry) => entry.reasonTokens)),
      requirements: inconclusiveRequirements,
      state: 'open',
    }));
  }

  const deduped = new Map<string, MissionPortfolioEscalation>();
  for (const escalation of escalations) {
    deduped.set(escalation.portfolioEscalationId, escalation);
  }

  return [...deduped.values()].sort((left, right) => {
    const bySeverity = severityRank(right.severity) - severityRank(left.severity);
    if (bySeverity !== 0) {
      return bySeverity;
    }

    const byClass = left.escalationClass.localeCompare(right.escalationClass);
    if (byClass !== 0) {
      return byClass;
    }

    return left.portfolioEscalationId.localeCompare(right.portfolioEscalationId);
  });
}
