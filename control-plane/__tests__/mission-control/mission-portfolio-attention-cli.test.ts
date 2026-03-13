import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as queueMain } from '../../cli/mission-control-portfolio-attention-queue.ts';
import { main as statusMain } from '../../cli/mission-control-portfolio-attention-status.ts';
import { main as requirementsMain } from '../../cli/mission-control-portfolio-attention-requirements.ts';
import { main as escalationsMain } from '../../cli/mission-control-portfolio-escalations.ts';
import { main as actionHistoryMain } from '../../cli/mission-control-portfolio-action-history.ts';
import { main as actionOutcomeMain } from '../../cli/mission-control-portfolio-action-outcome.ts';
import { main as acknowledgeMain } from '../../cli/mission-control-portfolio-acknowledge.ts';
import { main as deferMain } from '../../cli/mission-control-portfolio-defer.ts';
import { main as escalateMain } from '../../cli/mission-control-portfolio-escalate.ts';
import { main as forceReviewMain } from '../../cli/mission-control-portfolio-force-review.ts';
import { main as suppressMain } from '../../cli/mission-control-portfolio-suppress.ts';
import { main as materializeMain } from '../../cli/mission-control-portfolio-attention-materialize.ts';

const {
  listPortfolioAttentionQueue,
  inspectPortfolioAttentionStatus,
  inspectPortfolioAttentionRequirements,
  inspectPortfolioEscalations,
  inspectPortfolioActionHistory,
  inspectPortfolioActionOutcome,
  acknowledgePortfolio,
  deferPortfolio,
  escalatePortfolio,
  forcePortfolioReview,
  suppressPortfolioAttention,
  materializeOne,
} = vi.hoisted(() => ({
  listPortfolioAttentionQueue: vi.fn(() => []),
  inspectPortfolioAttentionStatus: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', attentionStatus: 'awaiting_attention' })),
  inspectPortfolioAttentionRequirements: vi.fn(() => []),
  inspectPortfolioEscalations: vi.fn(() => []),
  inspectPortfolioActionHistory: vi.fn(() => []),
  inspectPortfolioActionOutcome: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', actionOutcome: 'pending' })),
  acknowledgePortfolio: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', attentionStatus: 'acknowledged' } })),
  deferPortfolio: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', attentionStatus: 'deferred' } })),
  escalatePortfolio: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', attentionStatus: 'escalated' } })),
  forcePortfolioReview: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', attentionStatus: 'under_attention' } })),
  suppressPortfolioAttention: vi.fn(() => ({ statusPreview: { missionPortfolioId: 'portfolio-1', attentionStatus: 'suppressed' } })),
  materializeOne: vi.fn(() => ({ missionPortfolioId: 'portfolio-1' })),
}));

vi.mock('../../mission-control/mission-portfolio-attention-inspection.ts', () => ({
  createMissionPortfolioAttentionInspection: vi.fn(() => ({
    listPortfolioAttentionQueue,
    inspectPortfolioAttentionStatus,
    inspectPortfolioAttentionRequirements,
    inspectPortfolioEscalations,
    inspectPortfolioActionHistory,
    inspectPortfolioActionOutcome,
  })),
}));

vi.mock('../../mission-control/mission-portfolio-attention-manager.ts', () => ({
  createMissionPortfolioAttentionManager: vi.fn(() => ({
    acknowledgePortfolio,
    deferPortfolio,
    escalatePortfolio,
    forcePortfolioReview,
    suppressPortfolioAttention,
  })),
}));

vi.mock('../../mission-control/mission-portfolio-attention-materializer.ts', () => ({
  createMissionPortfolioAttentionMaterializer: vi.fn(() => ({
    materializeOne,
  })),
}));

describe('mission portfolio attention cli', () => {
  it('T-MPA-CLI1 inspection commands route deterministically', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await queueMain([]);
    await statusMain(['--portfolio', 'portfolio-1']);
    await requirementsMain(['--portfolio=portfolio-1']);
    await escalationsMain(['--portfolio', 'portfolio-1']);
    await actionHistoryMain(['--portfolio', 'portfolio-1']);
    await actionOutcomeMain(['--portfolio=portfolio-1']);

    expect(listPortfolioAttentionQueue).toHaveBeenCalled();
    expect(inspectPortfolioAttentionStatus).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectPortfolioAttentionRequirements).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectPortfolioEscalations).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectPortfolioActionHistory).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectPortfolioActionOutcome).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });

    stdout.mockRestore();
  });

  it('T-MPA-CLI2 action and materialize commands append via manager only', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await acknowledgeMain(['--portfolio', 'portfolio-1']);
    await deferMain(['--portfolio', 'portfolio-1']);
    await escalateMain(['--portfolio', 'portfolio-1']);
    await forceReviewMain(['--portfolio', 'portfolio-1']);
    await suppressMain(['--portfolio', 'portfolio-1']);
    await materializeMain(['--portfolio', 'portfolio-1']);

    expect(acknowledgePortfolio).toHaveBeenCalled();
    expect(deferPortfolio).toHaveBeenCalled();
    expect(escalatePortfolio).toHaveBeenCalled();
    expect(forcePortfolioReview).toHaveBeenCalled();
    expect(suppressPortfolioAttention).toHaveBeenCalled();
    expect(materializeOne).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });

    stdout.mockRestore();
  });

  it('T-MPA-CLI3 stable JSON errors on parse failures', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --portfolio' })}\n`);

    stdout.mockRestore();
  });
});
