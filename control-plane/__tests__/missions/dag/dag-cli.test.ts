import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { main as historyMain } from '../../../cli/mission-dags-history.ts';
import { main as inspectMain } from '../../../cli/mission-dags-inspect.ts';
import { main as listMain } from '../../../cli/mission-dags-list.ts';
import { main as materializeMain } from '../../../cli/mission-dags-materialize.ts';
import { main as statusMain } from '../../../cli/mission-dags-status.ts';

const {
  listMissionDAGs,
  getMissionDAG,
  getMissionDAGStatus,
  getMissionDAGHistory,
  materializeMissionDAG,
} = vi.hoisted(() => ({
  listMissionDAGs: vi.fn(() => [{ dagId: 'dag-1', displayName: 'DAG One', rootMissionId: 'mission-root', nodeCount: 2, edgeCount: 1 }]),
  getMissionDAG: vi.fn(() => ({ dagId: 'dag-1', rootMissionId: 'mission-root', dagStatus: 'READY' })),
  getMissionDAGStatus: vi.fn(() => ({ dagId: 'dag-1', dagStatus: 'READY', blockedNodes: [], readyNodes: ['mission-root'] })),
  getMissionDAGHistory: vi.fn(() => ({ dagId: 'dag-1', entries: [] })),
  materializeMissionDAG: vi.fn(() => ({ dagId: 'dag-1', statusPath: 'a', treePath: 'b', reportPath: 'c', historyPath: 'd' })),
}));

vi.mock('../../../missions/dag/mission-dag-inspection.ts', () => ({
  createMissionDAGInspection: vi.fn(() => ({
    listMissionDAGs,
    getMissionDAG,
    getMissionDAGStatus,
    getMissionDAGHistory,
    materializeMissionDAG,
  })),
}));

describe('mission DAG CLI commands', () => {
  it('T-MDAG-C1 mission-dags:list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listMissionDAGs())}\n`);
    stdout.mockRestore();
  });

  it('T-MDAG-C2 mission-dags:inspect requires --dag', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --dag');
    stdout.mockRestore();
  });

  it('T-MDAG-C3 mission-dags:status routes --dag', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--dag', 'dag-1']);

    expect(code).toBe(0);
    expect(getMissionDAGStatus).toHaveBeenCalledWith('dag-1');
    stdout.mockRestore();
  });

  it('T-MDAG-C4 mission-dags:history routes --dag', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--dag=dag-1']);

    expect(code).toBe(0);
    expect(getMissionDAGHistory).toHaveBeenCalledWith('dag-1');
    stdout.mockRestore();
  });

  it('T-MDAG-C5 mission-dags:materialize routes --dag', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--dag', 'dag-1']);

    expect(code).toBe(0);
    expect(materializeMissionDAG).toHaveBeenCalledWith('dag-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeMissionDAG())}\n`);
    stdout.mockRestore();
  });

  it('T-MDAG-C6 missing dag returns stable error payload shape', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    getMissionDAG.mockImplementationOnce(() => {
      throw new Error('MISSION_DAG_NOT_FOUND: missing');
    });

    const code = await inspectMain(['--dag', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSION_DAG_NOT_FOUND: missing' })}\n`);
    stdout.mockRestore();
  });
});
