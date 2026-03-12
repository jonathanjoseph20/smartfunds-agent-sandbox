import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as confirmMain } from '../../cli/mission-activation-confirm.ts';
import { main as evaluateMain } from '../../cli/mission-activation-evaluate.ts';
import { main as historyMain } from '../../cli/mission-activation-history.ts';
import { main as inspectMain } from '../../cli/mission-activation-inspect.ts';
import { main as listMain } from '../../cli/mission-activation-list.ts';
import { main as materializeMain } from '../../cli/mission-activation-materialize.ts';
import { main as rejectMain } from '../../cli/mission-activation-reject.ts';
import { main as statusMain } from '../../cli/mission-activation-status.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-activation-cli');

const {
  listActivationDecisions,
  inspectActivationDecision,
  getActivationStatus,
  getActivationHistory,
  materializeActivation,
  evaluateActivation,
  confirmActivation,
  rejectActivation,
} = vi.hoisted(() => ({
  listActivationDecisions: vi.fn(() => [{ activationDecisionId: 'a1', missionId: 'm1', activationState: 'under_review' }]),
  inspectActivationDecision: vi.fn(() => ({ missionId: 'm1', activationDecisionId: 'a1' })),
  getActivationStatus: vi.fn(() => ({ missionId: 'm1', activationState: 'under_review' })),
  getActivationHistory: vi.fn(() => ({ activationDecisionId: 'a1', missionId: 'm1', entries: [] })),
  materializeActivation: vi.fn(() => ({ activationDecisionId: 'a1', missionId: 'm1' })),
  evaluateActivation: vi.fn(() => ({ activationDecisionId: 'a1', missionId: 'm1' })),
  confirmActivation: vi.fn(() => ({ activationDecisionId: 'a1', missionId: 'm1', activationState: 'ready_for_activation' })),
  rejectActivation: vi.fn(() => ({ activationDecisionId: 'a1', missionId: 'm1', activationState: 'rejected' })),
}));

vi.mock('../../mission-activation/mission-activation-inspection.ts', () => ({
  createMissionActivationInspection: vi.fn(() => ({
    listActivationDecisions,
    inspectActivationDecision,
    getActivationStatus,
    getActivationHistory,
    materializeActivation,
    evaluateActivation,
    confirmActivation,
    rejectActivation,
  })),
}));

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission activation CLI commands', () => {
  it('T-MACT-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listActivationDecisions())}\n`);
    stdout.mockRestore();
  });

  it('T-MACT-CLI2 inspect requires --mission', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --mission');
    stdout.mockRestore();
  });

  it('T-MACT-CLI3 status routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--mission', 'm1']);

    expect(code).toBe(0);
    expect(getActivationStatus).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MACT-CLI4 history routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--mission=m1']);

    expect(code).toBe(0);
    expect(getActivationHistory).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MACT-CLI5 evaluate and confirm route mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const evalCode = await evaluateMain(['--mission', 'm1']);
    const confirmCode = await confirmMain(['--mission', 'm1']);

    expect(evalCode).toBe(0);
    expect(confirmCode).toBe(0);
    expect(evaluateActivation).toHaveBeenCalledWith({ missionId: 'm1' });
    expect(confirmActivation).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MACT-CLI6 materialize routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--mission', 'm1']);

    expect(code).toBe(0);
    expect(materializeActivation).toHaveBeenCalledWith({ missionId: 'm1' });
    stdout.mockRestore();
  });

  it('T-MACT-CLI7 reject reads reason file and routes payload', async () => {
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
    expect(rejectActivation).toHaveBeenCalledWith({
      missionId: 'm1',
      reason: 'manual rejection rationale',
      reviewedBy: 'founder',
    });
    stdout.mockRestore();
  });

  it('T-MACT-CLI8 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectActivationDecision.mockImplementationOnce(() => {
      throw new Error('MISSION_NOT_FOUND: missing');
    });

    const code = await inspectMain(['--mission', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSION_NOT_FOUND: missing' })}\n`);
    stdout.mockRestore();
  });
});
