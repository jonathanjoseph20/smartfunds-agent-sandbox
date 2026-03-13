import { describe, expect, it } from 'vitest';

import { createMissionPortfolioProjection } from '../../mission-control/mission-portfolio-projection.ts';

function runProjection() {
  return {
    projectAll: () => [
      {
        missionRunId: 'run-1',
        missionId: 'mission-1',
        executionAttemptId: 'attempt-1',
        runtimeEnvelopeId: 'env-1',
        executionContractId: 'contract-1',
        operationalState: 'active',
        completionState: 'in_progress',
        healthState: 'unstable',
        progressSummary: { completionPercent: 50 },
        escalations: [
          {
            escalationId: 'esc-1',
            escalationClass: 'policy_failure',
            severity: 'high',
            state: 'open',
          },
        ],
      },
      {
        missionRunId: 'run-2',
        missionId: 'mission-2',
        executionAttemptId: 'attempt-2',
        runtimeEnvelopeId: 'env-2',
        executionContractId: 'contract-2',
        operationalState: 'blocked',
        completionState: 'blocked',
        healthState: 'blocked',
        progressSummary: { completionPercent: 20 },
        escalations: [],
      },
    ],
    summarizeList: () => [
      { missionRunId: 'run-1' },
      { missionRunId: 'run-2' },
    ],
  } as never;
}

describe('mission portfolio projection', () => {
  it('T-MP-P1 projection replay is stable', () => {
    const projection = createMissionPortfolioProjection({
      missionRunProjection: runProjection(),
      missionCoordinationProjection: {
        projectOne: ({ missionRunId }: { missionRunId: string }) => ({
          missionRunId,
          coordinationState: missionRunId === 'run-2' ? 'blocked_by_dependency' : 'active',
          priority: missionRunId === 'run-1' ? 'critical' : 'high',
          dependencySummaries: missionRunId === 'run-2'
            ? [{ blockingReasonTokens: ['upstream'], sourceMissionRunId: 'run-2', targetMissionRunId: 'run-1', missionRelationshipId: 'rel-1', relationshipType: 'depends_on', state: 'active' }]
            : [],
          blockingMissionRunIds: missionRunId === 'run-2' ? ['run-1'] : [],
        }),
      } as never,
      missionReviewProjection: {
        projectOne: ({ missionRunId }: { missionRunId: string }) => ({
          missionRunId,
          governanceStatus: missionRunId === 'run-2' ? 'awaiting_review' : 'approved',
          decisionOutcome: missionRunId === 'run-2' ? 'pending' : 'approved',
          linkedDependencies: missionRunId === 'run-2' ? ['run-1'] : [],
          decisionRecords: missionRunId === 'run-1'
            ? [{ decisionRecordId: 'd-1', decisionOutcome: 'approved' }]
            : [],
        }),
      } as never,
    });

    const first = projection.projectAll();
    const second = projection.projectAll();

    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    expect(first[0]?.blockingClusters.length).toBeGreaterThan(0);
  });
});
