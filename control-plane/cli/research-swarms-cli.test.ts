import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './research-swarms-history.ts';
import { main as inspectMain } from './research-swarms-inspect.ts';
import { main as investigationsMain } from './research-swarms-investigations.ts';
import { main as listMain } from './research-swarms-list.ts';
import { main as materializeMain } from './research-swarms-materialize.ts';
import { main as readinessMain } from './research-swarms-readiness.ts';
import { main as statusMain } from './research-swarms-status.ts';

const {
  listSwarms,
  inspectSwarm,
  getSwarmStatus,
  getSwarmInvestigations,
  getSwarmReadiness,
  getSwarmHistory,
  materializeSwarm
} = vi.hoisted(() => ({
  listSwarms: vi.fn(() => [{ swarmId: 'protocol-risk-response', displayName: 'Protocol Risk Response Swarm', teamId: 'defi-risk-team', investigationTemplates: ['protocol-risk-investigation'] }]),
  inspectSwarm: vi.fn(() => ({ swarmId: 'protocol-risk-response', state: 'active' })),
  getSwarmStatus: vi.fn(() => ({ swarmId: 'protocol-risk-response', state: 'active', readiness: { readiness: 'analyzing' }, completion: { isComplete: false } })),
  getSwarmInvestigations: vi.fn(() => ({ swarmId: 'protocol-risk-response', investigations: [{ investigationRunId: 'run-1' }] })),
  getSwarmReadiness: vi.fn(() => ({ swarmId: 'protocol-risk-response', readiness: { readiness: 'analyzing' } })),
  getSwarmHistory: vi.fn(() => ({ swarmId: 'protocol-risk-response', entries: [] })),
  materializeSwarm: vi.fn(() => ({ swarmId: 'protocol-risk-response', statusPath: 'a', reportPath: 'b', markdownPath: 'c' }))
}));

vi.mock('../research-swarms/swarm-inspection.ts', () => ({
  createSwarmInspection: vi.fn(() => ({
    listSwarms,
    inspectSwarm,
    getSwarmStatus,
    getSwarmInvestigations,
    getSwarmReadiness,
    getSwarmHistory,
    materializeSwarm
  }))
}));

describe('research swarms CLI commands', () => {
  it('T-SW-CLI1 research-swarms:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listSwarms())}\n`);
    stdout.mockRestore();
  });

  it('T-SW-CLI2 research-swarms:inspect requires --swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --swarm');
    stdout.mockRestore();
  });

  it('T-SW-CLI3 research-swarms:status routes --swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--swarm', 'protocol-risk-response']);

    expect(code).toBe(0);
    expect(getSwarmStatus).toHaveBeenCalledWith('protocol-risk-response');
    stdout.mockRestore();
  });

  it('T-SW-CLI4 research-swarms:investigations routes --swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await investigationsMain(['--swarm=protocol-risk-response']);

    expect(code).toBe(0);
    expect(getSwarmInvestigations).toHaveBeenCalledWith('protocol-risk-response');
    stdout.mockRestore();
  });

  it('T-SW-CLI5 research-swarms:readiness routes --swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await readinessMain(['--swarm', 'protocol-risk-response']);

    expect(code).toBe(0);
    expect(getSwarmReadiness).toHaveBeenCalledWith('protocol-risk-response');
    stdout.mockRestore();
  });

  it('T-SW-CLI6 research-swarms:history routes --swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--swarm', 'protocol-risk-response']);

    expect(code).toBe(0);
    expect(getSwarmHistory).toHaveBeenCalledWith('protocol-risk-response');
    stdout.mockRestore();
  });

  it('T-SW-CLI7 research-swarms:materialize routes --swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--swarm', 'protocol-risk-response']);

    expect(code).toBe(0);
    expect(materializeSwarm).toHaveBeenCalledWith('protocol-risk-response');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeSwarm())}\n`);
    stdout.mockRestore();
  });
});
