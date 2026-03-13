import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as queueMain } from '../../cli/mission-control-portfolio-resolution-queue.ts';
import { main as stabilizationMain } from '../../cli/mission-control-portfolio-stabilization.ts';
import { main as resolutionStatusMain } from '../../cli/mission-control-portfolio-resolution-status.ts';
import { main as closureEligibilityMain } from '../../cli/mission-control-portfolio-closure-eligibility.ts';
import { main as closureStateMain } from '../../cli/mission-control-portfolio-closure-state.ts';
import { main as actionHistoryMain } from '../../cli/mission-control-portfolio-resolution-action-history.ts';
import { main as outcomeMain } from '../../cli/mission-control-portfolio-resolution-outcome.ts';
import { main as markStableMain } from '../../cli/mission-control-portfolio-mark-stable.ts';
import { main as markResolvedMain } from '../../cli/mission-control-portfolio-mark-resolved.ts';
import { main as closeMain } from '../../cli/mission-control-portfolio-close.ts';
import { main as reopenMain } from '../../cli/mission-control-portfolio-reopen.ts';
import { main as archiveMain } from '../../cli/mission-control-portfolio-archive.ts';
import { main as deferClosureMain } from '../../cli/mission-control-portfolio-defer-closure.ts';
import { main as requestReviewMain } from '../../cli/mission-control-portfolio-request-resolution-review.ts';
import { main as materializeMain } from '../../cli/mission-control-portfolio-resolution-materialize.ts';

const {
  listResolutionQueue,
  inspectStabilization,
  inspectResolutionStatus,
  inspectClosureEligibility,
  inspectClosureState,
  inspectResolutionActionHistory,
  inspectResolutionOutcome,
  markPortfolioStable,
  markPortfolioResolved,
  closePortfolio,
  reopenPortfolio,
  archivePortfolio,
  deferPortfolioClosure,
  requestPortfolioResolutionReview,
  materializeOne,
} = vi.hoisted(() => ({
  listResolutionQueue: vi.fn(() => []),
  inspectStabilization: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', stabilizationStatus: 'not_stable' })),
  inspectResolutionStatus: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', resolutionStatus: 'unresolved' })),
  inspectClosureEligibility: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', closureEligibility: 'not_closeable' })),
  inspectClosureState: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', closureState: 'open' })),
  inspectResolutionActionHistory: vi.fn(() => []),
  inspectResolutionOutcome: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', resolutionOutcome: 'pending' })),
  markPortfolioStable: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', stabilizationStatus: 'stable' } })),
  markPortfolioResolved: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', resolutionStatus: 'resolved' } })),
  closePortfolio: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', closureState: 'closed' } })),
  reopenPortfolio: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', closureState: 'reopened' } })),
  archivePortfolio: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', closureState: 'archived' } })),
  deferPortfolioClosure: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', resolutionOutcome: 'deferred' } })),
  requestPortfolioResolutionReview: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', closureState: 'under_resolution_review' } })),
  materializeOne: vi.fn(() => ({ missionPortfolioId: 'portfolio-1' })),
}));

vi.mock('../../mission-control/mission-portfolio-resolution-inspection.ts', () => ({
  createMissionPortfolioResolutionInspection: vi.fn(() => ({
    listResolutionQueue,
    inspectStabilization,
    inspectResolutionStatus,
    inspectClosureEligibility,
    inspectClosureState,
    inspectResolutionActionHistory,
    inspectResolutionOutcome,
  })),
}));

vi.mock('../../mission-control/mission-portfolio-resolution-manager.ts', () => ({
  createMissionPortfolioResolutionManager: vi.fn(() => ({
    markPortfolioStable,
    markPortfolioResolved,
    closePortfolio,
    reopenPortfolio,
    archivePortfolio,
    deferPortfolioClosure,
    requestPortfolioResolutionReview,
  })),
}));

vi.mock('../../mission-control/mission-portfolio-resolution-materializer.ts', () => ({
  createMissionPortfolioResolutionMaterializer: vi.fn(() => ({
    materializeOne,
  })),
}));

describe('mission portfolio resolution cli', () => {
  it('T-MPR-CLI1 inspection commands route deterministically', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await queueMain([]);
    await stabilizationMain(['--portfolio', 'portfolio-1']);
    await resolutionStatusMain(['--portfolio=portfolio-1']);
    await closureEligibilityMain(['--portfolio', 'portfolio-1']);
    await closureStateMain(['--portfolio=portfolio-1']);
    await actionHistoryMain(['--portfolio', 'portfolio-1']);
    await outcomeMain(['--portfolio=portfolio-1']);

    expect(listResolutionQueue).toHaveBeenCalled();
    expect(inspectStabilization).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectResolutionStatus).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectClosureEligibility).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectClosureState).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectResolutionActionHistory).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectResolutionOutcome).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });

    stdout.mockRestore();
  });

  it('T-MPR-CLI2 action and materialize commands append via manager only', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await markStableMain(['--portfolio', 'portfolio-1']);
    await markResolvedMain(['--portfolio', 'portfolio-1']);
    await closeMain(['--portfolio', 'portfolio-1']);
    await reopenMain(['--portfolio', 'portfolio-1']);
    await archiveMain(['--portfolio', 'portfolio-1']);
    await deferClosureMain(['--portfolio', 'portfolio-1']);
    await requestReviewMain(['--portfolio', 'portfolio-1']);
    await materializeMain(['--portfolio', 'portfolio-1']);

    expect(markPortfolioStable).toHaveBeenCalled();
    expect(markPortfolioResolved).toHaveBeenCalled();
    expect(closePortfolio).toHaveBeenCalled();
    expect(reopenPortfolio).toHaveBeenCalled();
    expect(archivePortfolio).toHaveBeenCalled();
    expect(deferPortfolioClosure).toHaveBeenCalled();
    expect(requestPortfolioResolutionReview).toHaveBeenCalled();
    expect(materializeOne).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });

    stdout.mockRestore();
  });

  it('T-MPR-CLI3 stable JSON errors on parse failures', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await resolutionStatusMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --portfolio' })}\n`);

    stdout.mockRestore();
  });
});
