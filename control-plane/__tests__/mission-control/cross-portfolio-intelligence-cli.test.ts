import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/mission-control-cross-portfolio-list.ts';
import { main as inspectMain } from '../../cli/mission-control-cross-portfolio-inspect.ts';
import { main as dependenciesMain } from '../../cli/mission-control-cross-portfolio-dependencies.ts';
import { main as blockingMain } from '../../cli/mission-control-cross-portfolio-blocking.ts';
import { main as patternsMain } from '../../cli/mission-control-cross-portfolio-escalation-patterns.ts';
import { main as riskMain } from '../../cli/mission-control-cross-portfolio-risk.ts';
import { main as readinessMain } from '../../cli/mission-control-cross-portfolio-readiness.ts';
import { main as historyMain } from '../../cli/mission-control-cross-portfolio-history.ts';
import { main as materializeMain } from '../../cli/mission-control-cross-portfolio-materialize.ts';

const {
  listIntelligenceSets,
  inspectIntelligenceSet,
  inspectSharedDependencies,
  inspectBlockingClusters,
  inspectEscalationPatterns,
  inspectRiskPosture,
  inspectReadinessPosture,
  inspectIntelligenceHistory,
  materializeIntelligenceSet,
} = vi.hoisted(() => ({
  listIntelligenceSets: vi.fn(() => [{ crossPortfolioMissionIntelligenceSetId: 'set-1' }]),
  inspectIntelligenceSet: vi.fn(() => ({ crossPortfolioMissionIntelligenceSetId: 'set-1' })),
  inspectSharedDependencies: vi.fn(() => []),
  inspectBlockingClusters: vi.fn(() => []),
  inspectEscalationPatterns: vi.fn(() => []),
  inspectRiskPosture: vi.fn(() => ({ crossPortfolioMissionIntelligenceSetId: 'set-1', systemicRiskPosture: 'degraded' })),
  inspectReadinessPosture: vi.fn(() => ({ crossPortfolioMissionIntelligenceSetId: 'set-1', readinessPosture: 'blocked' })),
  inspectIntelligenceHistory: vi.fn(() => ({ crossPortfolioMissionIntelligenceSetId: 'set-1', entries: [] })),
  materializeIntelligenceSet: vi.fn(() => ({ crossPortfolioMissionIntelligenceSetId: 'set-1' })),
}));

vi.mock('../../mission-control/cross-portfolio-intelligence-inspection.ts', () => ({
  createCrossPortfolioMissionIntelligenceInspection: vi.fn(() => ({
    listIntelligenceSets,
    inspectIntelligenceSet,
    inspectSharedDependencies,
    inspectBlockingClusters,
    inspectEscalationPatterns,
    inspectRiskPosture,
    inspectReadinessPosture,
    inspectIntelligenceHistory,
  })),
}));

vi.mock('../../mission-control/cross-portfolio-intelligence-manager.ts', () => ({
  createCrossPortfolioMissionIntelligenceManager: vi.fn(() => ({
    materializeIntelligenceSet,
  })),
}));

describe('cross-portfolio intelligence cli', () => {
  it('T-CPMI-CLI1 list/inspect commands route deterministically', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await listMain([]);
    await inspectMain(['--intelligence-set', 'set-1']);
    await dependenciesMain(['--intelligence-set=set-1']);
    await blockingMain(['--intelligence-set', 'set-1']);
    await patternsMain(['--intelligence-set=set-1']);
    await riskMain(['--intelligence-set', 'set-1']);
    await readinessMain(['--intelligence-set=set-1']);
    await historyMain(['--intelligence-set', 'set-1']);
    await materializeMain(['--intelligence-set=set-1']);

    expect(listIntelligenceSets).toHaveBeenCalled();
    expect(inspectIntelligenceSet).toHaveBeenCalledWith({ crossPortfolioMissionIntelligenceSetId: 'set-1' });
    expect(inspectSharedDependencies).toHaveBeenCalledWith({ crossPortfolioMissionIntelligenceSetId: 'set-1' });
    expect(inspectBlockingClusters).toHaveBeenCalledWith({ crossPortfolioMissionIntelligenceSetId: 'set-1' });
    expect(inspectEscalationPatterns).toHaveBeenCalledWith({ crossPortfolioMissionIntelligenceSetId: 'set-1' });
    expect(inspectRiskPosture).toHaveBeenCalledWith({ crossPortfolioMissionIntelligenceSetId: 'set-1' });
    expect(inspectReadinessPosture).toHaveBeenCalledWith({ crossPortfolioMissionIntelligenceSetId: 'set-1' });
    expect(inspectIntelligenceHistory).toHaveBeenCalledWith({ crossPortfolioMissionIntelligenceSetId: 'set-1' });
    expect(materializeIntelligenceSet).toHaveBeenCalledWith({ crossPortfolioMissionIntelligenceSetId: 'set-1' });

    stdout.mockRestore();
  });

  it('T-CPMI-CLI2 not found returns stable error payload', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectIntelligenceSet.mockImplementationOnce(() => {
      throw new Error('CROSS_PORTFOLIO_INTELLIGENCE_SET_NOT_FOUND');
    });

    const code = await inspectMain(['--intelligence-set', 'missing']);
    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'intelligence_set_not_found' })}\n`);
    stdout.mockRestore();
  });

  it('T-CPMI-CLI3 parse failures return stable JSON errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --intelligence-set' })}\n`);
    stdout.mockRestore();
  });
});
