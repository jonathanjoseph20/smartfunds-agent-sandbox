import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionReviewManager } from '../../mission-control/mission-review-manager.ts';
import { createMissionReviewProjection } from '../../mission-control/mission-review-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-review-manager');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission review manager', () => {
  it('T-MR-M1 force review creates explainable review requirement when none exists', () => {
    const projection = createMissionReviewProjection({
      missionRunProjection: {
        summarizeList: () => [{ missionRunId: 'run-1' }],
      } as never,
      missionCoordinationProjection: {
        projectOne: () => ({
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
        }),
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const manager = createMissionReviewManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const result = manager.forceMissionReview({
      missionRunId: 'run-1',
      requestedBy: 'operator',
      reasonTokens: ['manual_override'],
    });

    expect(result.reviewRequirementClass).toBe('operator_forced_review');
    expect(result.queueState).toBe('decision_recorded');
    expect(result.decisionOutcome).toBe('review_escalated');
  });
});
