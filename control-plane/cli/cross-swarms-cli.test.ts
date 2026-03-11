import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './cross-swarms-history.ts';
import { main as inspectMain } from './cross-swarms-inspect.ts';
import { main as linksMain } from './cross-swarms-links.ts';
import { main as listMain } from './cross-swarms-list.ts';
import { main as materializeMain } from './cross-swarms-materialize.ts';
import { main as readinessMain } from './cross-swarms-readiness.ts';
import { main as statusMain } from './cross-swarms-status.ts';

const {
  listCrossSwarms,
  inspectCrossSwarm,
  getCrossSwarmStatus,
  getCrossSwarmLinks,
  getCrossSwarmReadiness,
  getCrossSwarmHistory,
  materializeCrossSwarm
} = vi.hoisted(() => ({
  listCrossSwarms: vi.fn(() => [{ crossSwarmId: 'protocol-response-cluster', displayName: 'Protocol Response Cluster', groupType: 'protocol_response_cluster', enabled: true }]),
  inspectCrossSwarm: vi.fn(() => ({ crossSwarmId: 'protocol-response-cluster', lifecycleState: 'progressing' })),
  getCrossSwarmStatus: vi.fn(() => ({ crossSwarmId: 'protocol-response-cluster', lifecycleState: 'progressing', readinessState: 'analyzing' })),
  getCrossSwarmLinks: vi.fn(() => ({ crossSwarmId: 'protocol-response-cluster', linkedSwarmIds: ['protocol-risk-response'] })),
  getCrossSwarmReadiness: vi.fn(() => ({ crossSwarmId: 'protocol-response-cluster', readinessState: 'analyzing' })),
  getCrossSwarmHistory: vi.fn(() => ({ crossSwarmId: 'protocol-response-cluster', entries: [] })),
  materializeCrossSwarm: vi.fn(() => ({ crossSwarmId: 'protocol-response-cluster', statusPath: 'a', reportPath: 'b', markdownPath: 'c', historyPath: 'd' }))
}));

vi.mock('../cross-swarms/cross-swarm-inspection.ts', () => ({
  createCrossSwarmInspection: vi.fn(() => ({
    listCrossSwarms,
    inspectCrossSwarm,
    getCrossSwarmStatus,
    getCrossSwarmLinks,
    getCrossSwarmReadiness,
    getCrossSwarmHistory,
    materializeCrossSwarm
  }))
}));

describe('cross-swarms CLI commands', () => {
  it('T-CS-CLI1 cross-swarms:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listCrossSwarms())}\n`);
    stdout.mockRestore();
  });

  it('T-CS-CLI2 cross-swarms:inspect requires --cross-swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --cross-swarm');
    stdout.mockRestore();
  });

  it('T-CS-CLI3 cross-swarms:status routes --cross-swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--cross-swarm', 'protocol-response-cluster']);

    expect(code).toBe(0);
    expect(getCrossSwarmStatus).toHaveBeenCalledWith('protocol-response-cluster');
    stdout.mockRestore();
  });

  it('T-CS-CLI4 cross-swarms:links routes --cross-swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await linksMain(['--cross-swarm=protocol-response-cluster']);

    expect(code).toBe(0);
    expect(getCrossSwarmLinks).toHaveBeenCalledWith('protocol-response-cluster');
    stdout.mockRestore();
  });

  it('T-CS-CLI5 cross-swarms:readiness routes --cross-swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await readinessMain(['--cross-swarm', 'protocol-response-cluster']);

    expect(code).toBe(0);
    expect(getCrossSwarmReadiness).toHaveBeenCalledWith('protocol-response-cluster');
    stdout.mockRestore();
  });

  it('T-CS-CLI6 cross-swarms:history routes --cross-swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--cross-swarm', 'protocol-response-cluster']);

    expect(code).toBe(0);
    expect(getCrossSwarmHistory).toHaveBeenCalledWith('protocol-response-cluster');
    stdout.mockRestore();
  });

  it('T-CS-CLI7 cross-swarms:materialize routes --cross-swarm', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--cross-swarm', 'protocol-response-cluster']);

    expect(code).toBe(0);
    expect(materializeCrossSwarm).toHaveBeenCalledWith('protocol-response-cluster');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeCrossSwarm())}\n`);
    stdout.mockRestore();
  });
});
