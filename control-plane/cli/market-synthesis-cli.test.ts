import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './market-synthesis-history.ts';
import { main as inspectMain } from './market-synthesis-inspect.ts';
import { main as linksMain } from './market-synthesis-links.ts';
import { main as listMain } from './market-synthesis-list.ts';
import { main as materializeMain } from './market-synthesis-materialize.ts';
import { main as readinessMain } from './market-synthesis-readiness.ts';
import { main as statusMain } from './market-synthesis-status.ts';

const {
  listMarketSyntheses,
  inspectMarketSynthesis,
  getMarketStatus,
  getMarketLinks,
  getMarketReadiness,
  getMarketHistory,
  materializeMarketSynthesis
} = vi.hoisted(() => ({
  listMarketSyntheses: vi.fn(() => [{ marketSynthesisId: 'market-risk-synthesis', displayName: 'Market Risk', synthesisType: 'market_risk', enabled: true }]),
  inspectMarketSynthesis: vi.fn(() => ({ marketSynthesisId: 'market-risk-synthesis', lifecycleState: 'progressing' })),
  getMarketStatus: vi.fn(() => ({ marketSynthesisId: 'market-risk-synthesis', lifecycleState: 'progressing', readinessState: 'analyzing', completionState: 'incomplete' })),
  getMarketLinks: vi.fn(() => ({ marketSynthesisId: 'market-risk-synthesis', linkedCrossSwarmIds: ['protocol-response-cluster'] })),
  getMarketReadiness: vi.fn(() => ({ marketSynthesisId: 'market-risk-synthesis', readinessState: 'analyzing' })),
  getMarketHistory: vi.fn(() => ({ marketSynthesisId: 'market-risk-synthesis', entries: [] })),
  materializeMarketSynthesis: vi.fn(() => ({ marketSynthesisId: 'market-risk-synthesis', statusPath: 'a', reportPath: 'b', markdownPath: 'c', historyPath: 'd' }))
}));

vi.mock('../market-synthesis/market-synthesis-inspection.ts', () => ({
  createMarketInspection: vi.fn(() => ({
    listMarketSyntheses,
    inspectMarketSynthesis,
    getMarketStatus,
    getMarketLinks,
    getMarketReadiness,
    getMarketHistory,
    materializeMarketSynthesis,
  }))
}));

describe('market-synthesis CLI commands', () => {
  it('T-MS-CLI1 market-synthesis:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listMarketSyntheses())}\n`);
    stdout.mockRestore();
  });

  it('T-MS-CLI2 market-synthesis:inspect requires --market', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --market');
    stdout.mockRestore();
  });

  it('T-MS-CLI3 market-synthesis:status routes --market', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--market', 'market-risk-synthesis']);

    expect(code).toBe(0);
    expect(getMarketStatus).toHaveBeenCalledWith('market-risk-synthesis');
    stdout.mockRestore();
  });

  it('T-MS-CLI4 market-synthesis:links routes --market', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await linksMain(['--market=market-risk-synthesis']);

    expect(code).toBe(0);
    expect(getMarketLinks).toHaveBeenCalledWith('market-risk-synthesis');
    stdout.mockRestore();
  });

  it('T-MS-CLI5 market-synthesis:readiness routes --market', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await readinessMain(['--market', 'market-risk-synthesis']);

    expect(code).toBe(0);
    expect(getMarketReadiness).toHaveBeenCalledWith('market-risk-synthesis');
    stdout.mockRestore();
  });

  it('T-MS-CLI6 market-synthesis:history routes --market', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--market', 'market-risk-synthesis']);

    expect(code).toBe(0);
    expect(getMarketHistory).toHaveBeenCalledWith('market-risk-synthesis');
    stdout.mockRestore();
  });

  it('T-MS-CLI7 market-synthesis:materialize routes --market', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--market', 'market-risk-synthesis']);

    expect(code).toBe(0);
    expect(materializeMarketSynthesis).toHaveBeenCalledWith('market-risk-synthesis');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeMarketSynthesis())}\n`);
    stdout.mockRestore();
  });
});
