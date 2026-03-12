import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as confirmMain } from '../../cli/execution-contract-confirm.ts';
import { main as evaluateMain } from '../../cli/execution-contract-evaluate.ts';
import { main as historyMain } from '../../cli/execution-contract-history.ts';
import { main as inspectMain } from '../../cli/execution-contract-inspect.ts';
import { main as listMain } from '../../cli/execution-contract-list.ts';
import { main as materializeMain } from '../../cli/execution-contract-materialize.ts';
import { main as rejectMain } from '../../cli/execution-contract-reject.ts';
import { main as statusMain } from '../../cli/execution-contract-status.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-contract-cli');

const {
  listExecutionContracts,
  inspectExecutionContract,
  getExecutionContractStatus,
  getExecutionContractHistory,
  materializeExecutionContract,
  evaluateExecutionContract,
  confirmExecutionContract,
  rejectExecutionContract,
} = vi.hoisted(() => ({
  listExecutionContracts: vi.fn(() => [{ executionContractId: 'ec-1', missionId: 'm1', contractState: 'under_review' }]),
  inspectExecutionContract: vi.fn(() => ({ missionId: 'm1', executionContractId: 'ec-1' })),
  getExecutionContractStatus: vi.fn(() => ({ missionId: 'm1', contractState: 'under_review' })),
  getExecutionContractHistory: vi.fn(() => ({ executionContractId: 'ec-1', missionId: 'm1', entries: [] })),
  materializeExecutionContract: vi.fn(() => ({ executionContractId: 'ec-1', missionId: 'm1' })),
  evaluateExecutionContract: vi.fn(() => ({ executionContractId: 'ec-1', missionId: 'm1' })),
  confirmExecutionContract: vi.fn(() => ({ executionContractId: 'ec-1', missionId: 'm1', contractState: 'ready_for_runtime_handoff' })),
  rejectExecutionContract: vi.fn(() => ({ executionContractId: 'ec-1', missionId: 'm1', contractState: 'rejected' })),
}));

vi.mock('../../execution-contract/execution-contract-inspection.ts', () => ({
  createExecutionContractInspection: vi.fn(() => ({
    listExecutionContracts,
    inspectExecutionContract,
    getExecutionContractStatus,
    getExecutionContractHistory,
    materializeExecutionContract,
    evaluateExecutionContract,
    confirmExecutionContract,
    rejectExecutionContract,
  })),
}));

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution contract CLI commands', () => {
  it('T-MEC-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listExecutionContracts())}\n`);
    stdout.mockRestore();
  });

  it('T-MEC-CLI2 inspect requires --mission', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --mission');
    stdout.mockRestore();
  });

  it('T-MEC-CLI3 status routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--mission', 'm1']);

    expect(code).toBe(0);
    expect(getExecutionContractStatus).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MEC-CLI4 history routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--mission=m1']);

    expect(code).toBe(0);
    expect(getExecutionContractHistory).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MEC-CLI5 evaluate and confirm route mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const evalCode = await evaluateMain(['--mission', 'm1']);
    const confirmCode = await confirmMain(['--mission', 'm1']);

    expect(evalCode).toBe(0);
    expect(confirmCode).toBe(0);
    expect(evaluateExecutionContract).toHaveBeenCalledWith({ missionId: 'm1' });
    expect(confirmExecutionContract).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MEC-CLI6 materialize routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--mission', 'm1']);

    expect(code).toBe(0);
    expect(materializeExecutionContract).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MEC-CLI7 reject reads reason file and routes payload', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const reasonFile = path.join(tmpRoot, 'reason.txt');
    fs.writeFileSync(reasonFile, 'manual rejection rationale\n', 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await rejectMain([
      '--mission',
      'm1',
      '--reason-file',
      reasonFile,
      '--reviewed-by',
      'founder',
    ]);

    expect(code).toBe(0);
    expect(rejectExecutionContract).toHaveBeenCalledWith({
      missionId: 'm1',
      reason: 'manual rejection rationale',
      reviewedBy: 'founder',
    });
    stdout.mockRestore();
  });

  it('T-MEC-CLI8 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectExecutionContract.mockImplementationOnce(() => {
      throw new Error('MISSION_NOT_FOUND: missing');
    });

    const code = await inspectMain(['--mission', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSION_NOT_FOUND: missing' })}\n`);
    stdout.mockRestore();
  });
});
