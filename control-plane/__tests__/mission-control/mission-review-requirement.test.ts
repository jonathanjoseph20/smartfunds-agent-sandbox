import { describe, expect, it } from 'vitest';

import { deriveMissionReviewRequirements } from '../../mission-control/mission-review-requirement.ts';
import type { MissionCoordinationProjection } from '../../mission-control/mission-coordination.ts';

function coordination(overrides: Partial<MissionCoordinationProjection> = {}): MissionCoordinationProjection {
  return {
    missionRunId: 'run-1',
    lifecycleState: 'active',
    coordinationState: 'active',
    priority: 'normal',
    activeInterventions: [],
    dependencySummaries: [],
    blockingMissionRunIds: [],
    blockedByEscalations: [],
    resumeEligibility: 'ineligible',
    lastLifecycleTransitionId: null,
    lastInterventionId: null,
    statusPreview: {},
    reportPreview: {},
    ...overrides,
  };
}

describe('mission review requirements', () => {
  it('T-MR-R1 derives critical escalation and dependency requirements', () => {
    const requirements = deriveMissionReviewRequirements({
      missionRunId: 'run-1',
      coordination: coordination({
        blockedByEscalations: ['esc-1'],
        blockingMissionRunIds: ['run-upstream'],
      }),
      historyEntries: [],
    });

    expect(requirements.map((entry) => entry.reviewRequirementClass)).toEqual([
      'critical_escalation_review',
      'dependency_resolution_review',
    ]);
  });

  it('T-MR-R2 derives operator forced and changes requested requirement surfaces', () => {
    const requirements = deriveMissionReviewRequirements({
      missionRunId: 'run-1',
      coordination: coordination(),
      historyEntries: [
        {
          missionRunId: 'run-1',
          eventType: 'mission_decision_recorded',
          eventDedupeKey: 'e1',
          reasonTokens: [],
          payload: {
            decisionRecord: {
              decisionType: 'force_review',
            },
          },
        },
        {
          missionRunId: 'run-1',
          eventType: 'mission_changes_requested',
          eventDedupeKey: 'e2',
          reasonTokens: [],
          payload: {},
        },
      ],
    });

    expect(requirements.map((entry) => entry.reviewRequirementClass)).toContain('operator_forced_review');
    expect(requirements.map((entry) => entry.reviewRequirementClass)).toContain('changes_requested_review');
  });

  it('T-MR-R3 does not infer awaiting review without explainable requirement unless force review exists', () => {
    const noRequirements = deriveMissionReviewRequirements({
      missionRunId: 'run-1',
      coordination: coordination(),
      historyEntries: [],
    });

    expect(noRequirements).toHaveLength(0);

    const forcedRequirements = deriveMissionReviewRequirements({
      missionRunId: 'run-1',
      coordination: coordination(),
      historyEntries: [{
        missionRunId: 'run-1',
        eventType: 'mission_decision_recorded',
        eventDedupeKey: 'f1',
        reasonTokens: [],
        payload: {
          decisionRecord: {
            decisionType: 'force_review',
          },
        },
      }],
    });

    expect(forcedRequirements.map((entry) => entry.reviewRequirementClass)).toContain('operator_forced_review');
  });
});
