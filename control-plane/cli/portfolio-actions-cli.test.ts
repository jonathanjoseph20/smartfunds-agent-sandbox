import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './portfolio-actions-history.ts';
import { main as inspectMain } from './portfolio-actions-inspect.ts';
import { main as linksMain } from './portfolio-actions-links.ts';
import { main as listMain } from './portfolio-actions-list.ts';
import { main as materializeMain } from './portfolio-actions-materialize.ts';
import { main as priorityMain } from './portfolio-actions-priority.ts';
import { main as readinessMain } from './portfolio-actions-readiness.ts';
import { main as statusMain } from './portfolio-actions-status.ts';

const {
  listPortfolioActions,
  inspectPortfolioAction,
  getPortfolioActionStatus,
  getPortfolioActionLinks,
  getPortfolioActionReadiness,
  getPortfolioActionPriority,
  getPortfolioActionHistory,
  materializeOne,
} = vi.hoisted(() => ({
  listPortfolioActions: vi.fn(() => [{ actionId: 'reduce-risk-exposure', displayName: 'Reduce Risk Exposure', actionType: 'risk_reduction', enabled: true }]),
  inspectPortfolioAction: vi.fn(() => ({ actionId: 'reduce-risk-exposure', lifecycleState: 'progressing' })),
  getPortfolioActionStatus: vi.fn(() => ({ actionId: 'reduce-risk-exposure', lifecycleState: 'progressing', readinessState: 'analyzing', completionState: 'incomplete', priority: 'normal', routeCategory: 'review' })),
  getPortfolioActionLinks: vi.fn(() => ({ actionId: 'reduce-risk-exposure', linkedPortfolioIds: ['defi-core-portfolio'] })),
  getPortfolioActionReadiness: vi.fn(() => ({ actionId: 'reduce-risk-exposure', readinessState: 'analyzing' })),
  getPortfolioActionPriority: vi.fn(() => ({ actionId: 'reduce-risk-exposure', priority: 'normal', routeCategory: 'review' })),
  getPortfolioActionHistory: vi.fn(() => ({ actionId: 'reduce-risk-exposure', entries: [] })),
  materializeOne: vi.fn(() => ({ actionId: 'reduce-risk-exposure', statusPath: 'a', historyPath: 'b', reportPath: 'c', markdownPath: 'd' })),
}));

vi.mock('../portfolio-actions/portfolio-action-inspection.ts', () => ({
  createPortfolioActionInspection: vi.fn(() => ({
    listPortfolioActions,
    inspectPortfolioAction,
    getPortfolioActionStatus,
    getPortfolioActionLinks,
    getPortfolioActionReadiness,
    getPortfolioActionPriority,
    getPortfolioActionHistory,
  }))
}));

vi.mock('../portfolio-actions/portfolio-action-materializer.ts', () => ({
  createPortfolioActionMaterializer: vi.fn(() => ({
    materializeOne,
  }))
}));

describe('portfolio-actions CLI commands', () => {
  it('T-PA-CLI1 portfolio-actions:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listPortfolioActions())}\n`);
    stdout.mockRestore();
  });

  it('T-PA-CLI2 portfolio-actions:inspect requires --action', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --action');
    stdout.mockRestore();
  });

  it('T-PA-CLI3 portfolio-actions:status routes --action', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--action', 'reduce-risk-exposure']);

    expect(code).toBe(0);
    expect(getPortfolioActionStatus).toHaveBeenCalledWith('reduce-risk-exposure');
    stdout.mockRestore();
  });

  it('T-PA-CLI4 portfolio-actions:links routes --action', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await linksMain(['--action=reduce-risk-exposure']);

    expect(code).toBe(0);
    expect(getPortfolioActionLinks).toHaveBeenCalledWith('reduce-risk-exposure');
    stdout.mockRestore();
  });

  it('T-PA-CLI5 portfolio-actions:readiness routes --action', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await readinessMain(['--action', 'reduce-risk-exposure']);

    expect(code).toBe(0);
    expect(getPortfolioActionReadiness).toHaveBeenCalledWith('reduce-risk-exposure');
    stdout.mockRestore();
  });

  it('T-PA-CLI6 portfolio-actions:priority routes --action', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await priorityMain(['--action', 'reduce-risk-exposure']);

    expect(code).toBe(0);
    expect(getPortfolioActionPriority).toHaveBeenCalledWith('reduce-risk-exposure');
    stdout.mockRestore();
  });

  it('T-PA-CLI7 portfolio-actions:history routes --action', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--action', 'reduce-risk-exposure']);

    expect(code).toBe(0);
    expect(getPortfolioActionHistory).toHaveBeenCalledWith('reduce-risk-exposure');
    stdout.mockRestore();
  });

  it('T-PA-CLI8 portfolio-actions:materialize routes --action', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--action', 'reduce-risk-exposure']);

    expect(code).toBe(0);
    expect(materializeOne).toHaveBeenCalledWith('reduce-risk-exposure');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeOne())}\n`);
    stdout.mockRestore();
  });
});
