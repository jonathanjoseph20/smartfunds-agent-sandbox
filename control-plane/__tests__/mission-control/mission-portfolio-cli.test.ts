import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/mission-control-portfolios.ts';
import { main as inspectMain } from '../../cli/mission-control-portfolio-inspect.ts';
import { main as readinessMain } from '../../cli/mission-control-portfolio-readiness.ts';
import { main as healthMain } from '../../cli/mission-control-portfolio-health.ts';
import { main as governanceMain } from '../../cli/mission-control-portfolio-governance.ts';
import { main as blockingMain } from '../../cli/mission-control-portfolio-blocking.ts';
import { main as membershipMain } from '../../cli/mission-control-portfolio-membership.ts';
import { main as historyMain } from '../../cli/mission-control-portfolio-history.ts';
import { main as materializeMain } from '../../cli/mission-control-portfolio-materialize.ts';

const {
  listMissionPortfolios,
  inspectMissionPortfolio,
  inspectMissionPortfolioReadiness,
  inspectMissionPortfolioHealth,
  inspectMissionPortfolioGovernancePosture,
  inspectMissionPortfolioBlocking,
  inspectMissionPortfolioMembership,
  inspectMissionPortfolioHistory,
  materializeOne,
} = vi.hoisted(() => ({
  listMissionPortfolios: vi.fn(() => [{ missionPortfolioId: 'portfolio-1' }]),
  inspectMissionPortfolio: vi.fn(() => ({ missionPortfolioId: 'portfolio-1' })),
  inspectMissionPortfolioReadiness: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', readinessState: 'ready' })),
  inspectMissionPortfolioHealth: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', healthState: 'healthy' })),
  inspectMissionPortfolioGovernancePosture: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', governancePosture: 'clear' })),
  inspectMissionPortfolioBlocking: vi.fn(() => []),
  inspectMissionPortfolioMembership: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', memberships: [] })),
  inspectMissionPortfolioHistory: vi.fn(() => ({ missionPortfolioId: 'portfolio-1', entries: [] })),
  materializeOne: vi.fn(() => ({ missionPortfolioId: 'portfolio-1' })),
}));

vi.mock('../../mission-control/mission-portfolio-inspection.ts', () => ({
  createMissionPortfolioInspection: vi.fn(() => ({
    listMissionPortfolios,
    inspectMissionPortfolio,
    inspectMissionPortfolioReadiness,
    inspectMissionPortfolioHealth,
    inspectMissionPortfolioGovernancePosture,
    inspectMissionPortfolioBlocking,
    inspectMissionPortfolioMembership,
    inspectMissionPortfolioHistory,
  })),
}));

vi.mock('../../mission-control/mission-portfolio-materializer.ts', () => ({
  createMissionPortfolioMaterializer: vi.fn(() => ({
    materializeOne,
  })),
}));

describe('mission portfolio cli', () => {
  it('T-MP-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listMissionPortfolios())}\n`);
    stdout.mockRestore();
  });

  it('T-MP-CLI2 portfolio scoped commands route --portfolio', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await inspectMain(['--portfolio', 'portfolio-1']);
    await readinessMain(['--portfolio=portfolio-1']);
    await healthMain(['--portfolio', 'portfolio-1']);
    await governanceMain(['--portfolio', 'portfolio-1']);
    await blockingMain(['--portfolio', 'portfolio-1']);
    await membershipMain(['--portfolio=portfolio-1']);
    await historyMain(['--portfolio', 'portfolio-1']);
    await materializeMain(['--portfolio', 'portfolio-1']);

    expect(inspectMissionPortfolio).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectMissionPortfolioReadiness).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectMissionPortfolioHealth).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectMissionPortfolioGovernancePosture).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectMissionPortfolioBlocking).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectMissionPortfolioMembership).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(inspectMissionPortfolioHistory).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });
    expect(materializeOne).toHaveBeenCalledWith({ missionPortfolioId: 'portfolio-1' });

    stdout.mockRestore();
  });

  it('T-MP-CLI3 stable error payload is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectMissionPortfolio.mockImplementationOnce(() => {
      throw new Error('MISSION_PORTFOLIO_NOT_FOUND');
    });

    const code = await inspectMain(['--portfolio', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSION_PORTFOLIO_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
