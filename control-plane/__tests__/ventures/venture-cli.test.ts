import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as historyMain } from '../../cli/ventures-history.ts';
import { main as inspectMain } from '../../cli/ventures-inspect.ts';
import { main as listMain } from '../../cli/ventures-list.ts';
import { main as materializeMain } from '../../cli/ventures-materialize.ts';
import { main as statusMain } from '../../cli/ventures-status.ts';

const {
  listVentures,
  inspectVenture,
  getVentureStatus,
  getVentureHistory,
  materializeVenture,
} = vi.hoisted(() => ({
  listVentures: vi.fn(() => [{ ventureId: 'venture-1', ventureSlug: 'smartfunds-core' }]),
  inspectVenture: vi.fn(() => ({ ventureId: 'venture-1', ventureStatus: 'active' })),
  getVentureStatus: vi.fn(() => ({ ventureId: 'venture-1', ventureStatus: 'active' })),
  getVentureHistory: vi.fn(() => ({ ventureId: 'venture-1', entries: [] })),
  materializeVenture: vi.fn(() => ({ ventureId: 'venture-1', reportPath: 'a' })),
}));

vi.mock('../../ventures/venture-inspection.ts', () => ({
  createVentureInspection: vi.fn(() => ({
    listVentures,
    inspectVenture,
    getVentureStatus,
    getVentureHistory,
    materializeVenture,
  })),
}));

describe('venture CLI commands', () => {
  it('T-VCLI1 ventures:list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await listMain([]);
    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listVentures())}\n`);
    stdout.mockRestore();
  });

  it('T-VCLI2 ventures:inspect requires --venture', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await inspectMain([]);
    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT' })}\n`);
    stdout.mockRestore();
  });

  it('T-VCLI3 ventures:status routes --venture', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await statusMain(['--venture', 'venture-1']);
    expect(code).toBe(0);
    expect(getVentureStatus).toHaveBeenCalledWith('venture-1');
    stdout.mockRestore();
  });

  it('T-VCLI4 ventures:history routes --venture', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await historyMain(['--venture=venture-1']);
    expect(code).toBe(0);
    expect(getVentureHistory).toHaveBeenCalledWith('venture-1');
    stdout.mockRestore();
  });

  it('T-VCLI5 ventures:materialize routes --venture', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await materializeMain(['--venture', 'venture-1']);
    expect(code).toBe(0);
    expect(materializeVenture).toHaveBeenCalledWith('venture-1');
    stdout.mockRestore();
  });

  it('T-VCLI6 stable VENTURE_NOT_FOUND error payload', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectVenture.mockImplementationOnce(() => {
      throw new Error('VENTURE_NOT_FOUND');
    });

    const code = await inspectMain(['--venture', 'missing']);
    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'VENTURE_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
