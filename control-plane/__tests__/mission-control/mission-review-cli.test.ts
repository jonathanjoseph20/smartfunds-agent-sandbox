import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as reviewQueueMain } from '../../cli/mission-control-review-queue.ts';
import { main as reviewStatusMain } from '../../cli/mission-control-review-status.ts';
import { main as reviewRequirementsMain } from '../../cli/mission-control-review-requirements.ts';
import { main as decisionHistoryMain } from '../../cli/mission-control-decision-history.ts';
import { main as decisionOutcomeMain } from '../../cli/mission-control-decision-outcome.ts';
import { main as approveMain } from '../../cli/mission-control-approve.ts';
import { main as rejectMain } from '../../cli/mission-control-reject.ts';
import { main as deferMain } from '../../cli/mission-control-defer-review.ts';
import { main as requestChangesMain } from '../../cli/mission-control-request-changes.ts';
import { main as forceReviewMain } from '../../cli/mission-control-force-review.ts';
import { main as materializeMain } from '../../cli/mission-control-materialize-review.ts';

const {
  listReviewQueueEntries,
  inspectGovernanceStatus,
  inspectReviewRequirements,
  inspectDecisionHistory,
  inspectDecisionOutcome,
  approveMission,
  rejectMission,
  deferMissionReview,
  requestMissionChanges,
  forceMissionReview,
  materializeOne,
} = vi.hoisted(() => ({
  listReviewQueueEntries: vi.fn(() => []),
  inspectGovernanceStatus: vi.fn(() => ({ missionRunId: 'run-1', governanceStatus: 'awaiting_review' })),
  inspectReviewRequirements: vi.fn(() => []),
  inspectDecisionHistory: vi.fn(() => []),
  inspectDecisionOutcome: vi.fn(() => ({ missionRunId: 'run-1', decisionOutcome: 'pending' })),
  approveMission: vi.fn(() => ({ statusPreview: { missionRunId: 'run-1', governanceStatus: 'approved' } })),
  rejectMission: vi.fn(() => ({ statusPreview: { missionRunId: 'run-1', governanceStatus: 'rejected' } })),
  deferMissionReview: vi.fn(() => ({ statusPreview: { missionRunId: 'run-1', governanceStatus: 'deferred' } })),
  requestMissionChanges: vi.fn(() => ({ statusPreview: { missionRunId: 'run-1', governanceStatus: 'changes_requested' } })),
  forceMissionReview: vi.fn(() => ({ statusPreview: { missionRunId: 'run-1', governanceStatus: 'escalated_for_decision' } })),
  materializeOne: vi.fn(() => ({ missionRunId: 'run-1' })),
}));

vi.mock('../../mission-control/mission-review-inspection.ts', () => ({
  createMissionReviewInspection: vi.fn(() => ({
    listReviewQueueEntries,
    inspectGovernanceStatus,
    inspectReviewRequirements,
    inspectDecisionHistory,
    inspectDecisionOutcome,
  })),
}));

vi.mock('../../mission-control/mission-review-manager.ts', () => ({
  createMissionReviewManager: vi.fn(() => ({
    approveMission,
    rejectMission,
    deferMissionReview,
    requestMissionChanges,
    forceMissionReview,
  })),
}));

vi.mock('../../mission-control/mission-review-materializer.ts', () => ({
  createMissionReviewMaterializer: vi.fn(() => ({
    materializeOne,
  })),
}));

describe('mission review cli', () => {
  it('T-MR-CLI1 inspection commands route deterministically', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await reviewQueueMain([]);
    await reviewStatusMain(['--run', 'run-1']);
    await reviewRequirementsMain(['--run=run-1']);
    await decisionHistoryMain(['--run', 'run-1']);
    await decisionOutcomeMain(['--run=run-1']);

    expect(listReviewQueueEntries).toHaveBeenCalled();
    expect(inspectGovernanceStatus).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectReviewRequirements).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectDecisionHistory).toHaveBeenCalledWith({ missionRunId: 'run-1' });
    expect(inspectDecisionOutcome).toHaveBeenCalledWith({ missionRunId: 'run-1' });

    stdout.mockRestore();
  });

  it('T-MR-CLI2 decision commands append via manager only', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await approveMain(['--run', 'run-1', '--by', 'operator', '--reason', 'ok']);
    await rejectMain(['--run=run-1']);
    await deferMain(['--run', 'run-1']);
    await requestChangesMain(['--run', 'run-1']);
    await forceReviewMain(['--run', 'run-1']);
    await materializeMain(['--run', 'run-1']);

    expect(approveMission).toHaveBeenCalled();
    expect(rejectMission).toHaveBeenCalled();
    expect(deferMissionReview).toHaveBeenCalled();
    expect(requestMissionChanges).toHaveBeenCalled();
    expect(forceMissionReview).toHaveBeenCalled();
    expect(materializeOne).toHaveBeenCalledWith({ missionRunId: 'run-1' });

    stdout.mockRestore();
  });

  it('T-MR-CLI3 stable JSON errors on parse failures', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await reviewStatusMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --run' })}\n`);

    stdout.mockRestore();
  });
});
