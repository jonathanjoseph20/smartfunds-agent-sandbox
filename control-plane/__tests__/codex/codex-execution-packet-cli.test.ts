import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as createMain } from '../../cli/codex-execution-packet-create.ts';
import { main as inspectMain } from '../../cli/codex-execution-packet-inspect.ts';
import { main as listMain } from '../../cli/codex-execution-packet-list.ts';
import { main as materializeMain } from '../../cli/codex-execution-packet-materialize.ts';

const {
  createCodexExecutionPackets,
} = vi.hoisted(() => ({
  createCodexExecutionPackets: vi.fn(() => ({
    packetCount: 1,
    packetIds: ['packet-1'],
  })),
}));

const {
  listCodexExecutionPackets,
  inspectCodexExecutionPacket,
  materializeCodexExecutionPacket,
} = vi.hoisted(() => ({
  listCodexExecutionPackets: vi.fn(() => ([
    { packetId: 'packet-1', taskId: 'task-1', status: 'draft' },
  ])),
  inspectCodexExecutionPacket: vi.fn(() => ({
    packet: { packetId: 'packet-1' },
    validation: { validationState: 'valid' },
    projection: { packetId: 'packet-1', taskId: 'task-1', status: 'draft' },
    history: [],
  })),
  materializeCodexExecutionPacket: vi.fn(() => ({
    packetId: 'packet-1',
    dirPath: 'artifacts/codex/packet-1',
  })),
}));

vi.mock('../../codex/codex-execution-packet-manager.ts', () => ({
  createCodexExecutionPacketManager: vi.fn(() => ({
    createCodexExecutionPackets,
  })),
}));

vi.mock('../../codex/codex-execution-packet-inspection.ts', () => ({
  createCodexExecutionPacketInspection: vi.fn(() => ({
    listCodexExecutionPackets,
    inspectCodexExecutionPacket,
    materializeCodexExecutionPacket,
  })),
}));

describe('codex execution packet CLI', () => {
  it('T-PF4-CLI1 create/list/inspect/materialize output canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain(['--graph', 'graph-1'])).toBe(0);
    expect(await listMain([])).toBe(0);
    expect(await inspectMain(['--packet', 'packet-1'])).toBe(0);
    expect(await materializeMain(['--packet', 'packet-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ packetCount: 1, packetIds: ['packet-1'] })}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listCodexExecutionPackets())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectCodexExecutionPacket())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeCodexExecutionPacket())}\n`);

    stdout.mockRestore();
  });

  it('T-PF4-CLI2 returns code 1 with canonical error payload for input errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain([])).toBe(1);
    expect(await inspectMain([])).toBe(1);
    expect(await materializeMain([])).toBe(1);
    expect(await listMain(['--bad'])).toBe(1);

    const merged = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(merged).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --graph' }));
    expect(merged).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --packet' }));
    expect(merged).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
