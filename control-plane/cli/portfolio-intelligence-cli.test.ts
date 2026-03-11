import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './portfolio-intelligence-history.ts';
import { main as inspectMain } from './portfolio-intelligence-inspect.ts';
import { main as linksMain } from './portfolio-intelligence-links.ts';
import { main as listMain } from './portfolio-intelligence-list.ts';
import { main as materializeMain } from './portfolio-intelligence-materialize.ts';
import { main as readinessMain } from './portfolio-intelligence-readiness.ts';
import { main as riskMain } from './portfolio-intelligence-risk.ts';
import { main as statusMain } from './portfolio-intelligence-status.ts';

const {
  listPortfolioIntelligenceUnits,
  inspectPortfolioIntelligence,
  getPortfolioStatus,
  getPortfolioLinks,
  getPortfolioReadiness,
  getPortfolioRisk,
  getPortfolioHistory,
  materializePortfolioIntelligence
} = vi.hoisted(() => ({
  listPortfolioIntelligenceUnits: vi.fn(() => [{ portfolioId: 'defi-core-portfolio', displayName: 'DeFi Core Portfolio', portfolioType: 'defi', enabled: true }]),
  inspectPortfolioIntelligence: vi.fn(() => ({ portfolioId: 'defi-core-portfolio', lifecycleState: 'progressing' })),
  getPortfolioStatus: vi.fn(() => ({ portfolioId: 'defi-core-portfolio', lifecycleState: 'progressing', readinessState: 'analyzing', completionState: 'incomplete' })),
  getPortfolioLinks: vi.fn(() => ({ portfolioId: 'defi-core-portfolio', linkedMarketSynthesisIds: ['market-risk-synthesis'] })),
  getPortfolioReadiness: vi.fn(() => ({ portfolioId: 'defi-core-portfolio', readinessState: 'analyzing' })),
  getPortfolioRisk: vi.fn(() => ({ portfolioId: 'defi-core-portfolio', riskThemes: ['protocol_exposure_pressure'] })),
  getPortfolioHistory: vi.fn(() => ({ portfolioId: 'defi-core-portfolio', entries: [] })),
  materializePortfolioIntelligence: vi.fn(() => ({ portfolioId: 'defi-core-portfolio', statusPath: 'a', reportPath: 'b', markdownPath: 'c', historyPath: 'd' }))
}));

vi.mock('../portfolio-intelligence/portfolio-inspection.ts', () => ({
  createPortfolioInspection: vi.fn(() => ({
    listPortfolioIntelligenceUnits,
    inspectPortfolioIntelligence,
    getPortfolioStatus,
    getPortfolioLinks,
    getPortfolioReadiness,
    getPortfolioRisk,
    getPortfolioHistory,
    materializePortfolioIntelligence,
  }))
}));

describe('portfolio-intelligence CLI commands', () => {
  it('T-PI-CLI1 portfolio-intelligence:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listPortfolioIntelligenceUnits())}\n`);
    stdout.mockRestore();
  });

  it('T-PI-CLI2 portfolio-intelligence:inspect requires --portfolio', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --portfolio');
    stdout.mockRestore();
  });

  it('T-PI-CLI3 portfolio-intelligence:status routes --portfolio', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--portfolio', 'defi-core-portfolio']);

    expect(code).toBe(0);
    expect(getPortfolioStatus).toHaveBeenCalledWith('defi-core-portfolio');
    stdout.mockRestore();
  });

  it('T-PI-CLI4 portfolio-intelligence:links routes --portfolio', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await linksMain(['--portfolio=defi-core-portfolio']);

    expect(code).toBe(0);
    expect(getPortfolioLinks).toHaveBeenCalledWith('defi-core-portfolio');
    stdout.mockRestore();
  });

  it('T-PI-CLI5 portfolio-intelligence:readiness routes --portfolio', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await readinessMain(['--portfolio', 'defi-core-portfolio']);

    expect(code).toBe(0);
    expect(getPortfolioReadiness).toHaveBeenCalledWith('defi-core-portfolio');
    stdout.mockRestore();
  });

  it('T-PI-CLI6 portfolio-intelligence:risk routes --portfolio', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await riskMain(['--portfolio', 'defi-core-portfolio']);

    expect(code).toBe(0);
    expect(getPortfolioRisk).toHaveBeenCalledWith('defi-core-portfolio');
    stdout.mockRestore();
  });

  it('T-PI-CLI7 portfolio-intelligence:history routes --portfolio', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--portfolio', 'defi-core-portfolio']);

    expect(code).toBe(0);
    expect(getPortfolioHistory).toHaveBeenCalledWith('defi-core-portfolio');
    stdout.mockRestore();
  });

  it('T-PI-CLI8 portfolio-intelligence:materialize routes --portfolio', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--portfolio', 'defi-core-portfolio']);

    expect(code).toBe(0);
    expect(materializePortfolioIntelligence).toHaveBeenCalledWith('defi-core-portfolio');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializePortfolioIntelligence())}\n`);
    stdout.mockRestore();
  });
});
