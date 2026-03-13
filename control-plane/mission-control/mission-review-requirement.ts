import type { MissionCoordinationProjection } from './mission-coordination.ts';
import type {
  MissionReviewHistoryEntry,
  MissionReviewRequirement,
} from './mission-review-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasActiveForceReview(historyEntries: MissionReviewHistoryEntry[]): boolean {
  let latestForceReviewIndex = -1;
  let latestTerminalIndex = -1;

  for (let index = 0; index < historyEntries.length; index += 1) {
    const entry = historyEntries[index];
    if (entry.eventType === 'mission_decision_recorded') {
      const decisionType = (entry.payload.decisionRecord as Record<string, unknown> | undefined)?.decisionType;
      if (decisionType === 'force_review') {
        latestForceReviewIndex = index;
      }
      if (decisionType === 'approve' || decisionType === 'reject') {
        latestTerminalIndex = index;
      }
    }
  }

  return latestForceReviewIndex > latestTerminalIndex;
}

function hasChangesRequested(historyEntries: MissionReviewHistoryEntry[]): boolean {
  return historyEntries.some((entry) => entry.eventType === 'mission_changes_requested');
}

export function deriveMissionReviewRequirements(input: {
  missionRunId: string;
  coordination: MissionCoordinationProjection;
  historyEntries: MissionReviewHistoryEntry[];
}): MissionReviewRequirement[] {
  const requirements: MissionReviewRequirement[] = [];
  const base = {
    missionRunId: input.missionRunId,
    priority: input.coordination.priority,
  };

  if (input.coordination.blockedByEscalations.length > 0) {
    requirements.push({
      ...base,
      reviewRequirementClass: 'critical_escalation_review',
      reasonTokens: uniqueSorted(['critical_escalation_present', ...input.coordination.blockedByEscalations.map((value) => `escalation:${value}`)]),
      linkedEscalationIds: [...input.coordination.blockedByEscalations],
      linkedDependencyIds: [],
    });
  }

  if (input.coordination.blockingMissionRunIds.length > 0 || input.coordination.coordinationState === 'blocked_by_dependency') {
    requirements.push({
      ...base,
      reviewRequirementClass: 'dependency_resolution_review',
      reasonTokens: uniqueSorted(['dependency_blocking_present', ...input.coordination.blockingMissionRunIds.map((value) => `dependency:${value}`)]),
      linkedEscalationIds: [],
      linkedDependencyIds: [...input.coordination.blockingMissionRunIds],
    });
  }

  if (hasActiveForceReview(input.historyEntries)) {
    requirements.push({
      ...base,
      reviewRequirementClass: 'operator_forced_review',
      reasonTokens: ['operator_force_review_recorded'],
      linkedEscalationIds: [],
      linkedDependencyIds: [],
    });
  }

  if (input.coordination.priority === 'critical' || input.coordination.priority === 'high') {
    requirements.push({
      ...base,
      reviewRequirementClass: 'priority_review',
      reasonTokens: [`priority:${input.coordination.priority}`],
      linkedEscalationIds: [],
      linkedDependencyIds: [],
    });
  }

  if (hasChangesRequested(input.historyEntries)) {
    requirements.push({
      ...base,
      reviewRequirementClass: 'changes_requested_review',
      reasonTokens: ['changes_requested_open'],
      linkedEscalationIds: [],
      linkedDependencyIds: [],
    });
  }

  if (input.coordination.lifecycleState === 'completed') {
    requirements.push({
      ...base,
      reviewRequirementClass: 'completion_review',
      reasonTokens: ['mission_completed_requires_review'],
      linkedEscalationIds: [],
      linkedDependencyIds: [],
    });
  }

  if (input.coordination.coordinationState === 'inconclusive') {
    requirements.push({
      ...base,
      reviewRequirementClass: 'inconclusive_review',
      reasonTokens: ['coordination_inconclusive'],
      linkedEscalationIds: [],
      linkedDependencyIds: [],
    });
  }

  return requirements.sort((left, right) => left.reviewRequirementClass.localeCompare(right.reviewRequirementClass));
}
