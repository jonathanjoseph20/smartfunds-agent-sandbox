import { deriveMissionPortfolioAttentionQueueEntryId } from './mission-portfolio-attention-identity.ts';
import type {
  MissionPortfolioAttentionHistoryEntry,
  MissionPortfolioAttentionQueueEntry,
  MissionPortfolioAttentionQueueState,
  MissionPortfolioAttentionRequirement,
  MissionPortfolioAttentionStatus,
  MissionPortfolioEscalation,
  MissionPortfolioEscalationSeverity,
} from './mission-portfolio-attention-types.ts';

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

export function deriveAttentionPriority(input: {
  requirement: MissionPortfolioAttentionRequirement;
  escalation: MissionPortfolioEscalation | null;
  criticalMissionCount: number;
  highMissionCount: number;
}): number {
  const severity = input.escalation?.severity ?? input.requirement.severity;
  const severityScore = severityRank(severity) * 100;
  return severityScore + (input.criticalMissionCount * 10) + input.highMissionCount;
}

function deriveQueueState(input: {
  portfolioAttentionQueueEntryId: string;
  historyEntries: MissionPortfolioAttentionHistoryEntry[];
}): MissionPortfolioAttentionQueueState {
  let state: MissionPortfolioAttentionQueueState = 'queued';
  let seenQueuedEvent = false;

  for (const entry of input.historyEntries) {
    const payloadQueueEntryId = (entry.payload.portfolioAttentionQueueEntryId as string | undefined)
      ?? ((entry.payload.queueEntry as Record<string, unknown> | undefined)?.portfolioAttentionQueueEntryId as string | undefined)
      ?? ((entry.payload.actionRecord as Record<string, unknown> | undefined)?.portfolioAttentionQueueEntryId as string | undefined);

    if (payloadQueueEntryId !== input.portfolioAttentionQueueEntryId) {
      continue;
    }

    if (entry.eventType === 'portfolio_attention_queued') {
      seenQueuedEvent = true;
      state = 'awaiting_attention';
      continue;
    }

    if (entry.eventType === 'portfolio_attention_acknowledged') {
      state = 'under_attention';
      continue;
    }

    if (entry.eventType === 'portfolio_operator_action_recorded') {
      state = 'action_recorded';
      continue;
    }

    if (entry.eventType === 'portfolio_attention_deferred') {
      state = 'deferred';
      continue;
    }

    if (entry.eventType === 'portfolio_attention_closed') {
      state = 'closed';
    }
  }

  if (!seenQueuedEvent) {
    return 'queued';
  }

  return state;
}

export function selectPrimaryAttentionRequirement(input: {
  requirements: MissionPortfolioAttentionRequirement[];
}): MissionPortfolioAttentionRequirement | null {
  if (input.requirements.length === 0) {
    return null;
  }

  const classPriority = [
    'critical_blocking_cluster',
    'failed_member_attention',
    'operator_forced_attention',
    'governance_mixed_attention',
    'critical_priority_attention',
    'degraded_health_attention',
    'inconclusive_attention',
  ] as const;

  return [...input.requirements].sort((left, right) => {
    const bySeverity = severityRank(right.severity) - severityRank(left.severity);
    if (bySeverity !== 0) {
      return bySeverity;
    }

    const byClassPriority = classPriority.indexOf(left.requirementClass) - classPriority.indexOf(right.requirementClass);
    if (byClassPriority !== 0) {
      return byClassPriority;
    }

    return left.portfolioAttentionRequirementId.localeCompare(right.portfolioAttentionRequirementId);
  })[0];
}

export function deriveMissionPortfolioAttentionQueueEntry(input: {
  missionPortfolioId: string;
  attentionStatus: MissionPortfolioAttentionStatus;
  requirement: MissionPortfolioAttentionRequirement | null;
  escalation: MissionPortfolioEscalation | null;
  criticalMissionCount: number;
  highMissionCount: number;
  historyEntries: MissionPortfolioAttentionHistoryEntry[];
}): MissionPortfolioAttentionQueueEntry | null {
  if (!input.requirement) {
    return null;
  }

  const closedCycleCount = input.historyEntries.filter((entry) => {
    if (entry.eventType !== 'portfolio_attention_closed') {
      return false;
    }

    const closedRequirementClass = (entry.payload.queueEntry as Record<string, unknown> | undefined)?.requirementClass;
    return closedRequirementClass === input.requirement.requirementClass;
  }).length;

  const queueCycle = closedCycleCount + 1;

  const priority = deriveAttentionPriority({
    requirement: input.requirement,
    escalation: input.escalation,
    criticalMissionCount: input.criticalMissionCount,
    highMissionCount: input.highMissionCount,
  });

  const reasonTokens = uniqueSorted([
    ...input.requirement.reasonTokens,
    ...(input.escalation?.reasonTokens ?? []),
  ]);

  const portfolioAttentionQueueEntryId = deriveMissionPortfolioAttentionQueueEntryId({
    missionPortfolioId: input.missionPortfolioId,
    requirementClass: input.requirement.requirementClass,
    escalationClass: input.escalation?.escalationClass ?? null,
    queueCycle,
    priority,
    reasonTokens,
  });

  const queueState = deriveQueueState({
    portfolioAttentionQueueEntryId,
    historyEntries: input.historyEntries,
  });

  return {
    portfolioAttentionQueueEntryId,
    missionPortfolioId: input.missionPortfolioId,
    attentionStatus: input.attentionStatus,
    requirementClass: input.requirement.requirementClass,
    escalationClass: input.escalation?.escalationClass ?? null,
    priority,
    queueState,
    reasonTokens,
  };
}
