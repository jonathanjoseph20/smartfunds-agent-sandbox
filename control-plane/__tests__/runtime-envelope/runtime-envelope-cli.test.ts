import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as confirmMain } from '../../cli/runtime-envelope-confirm.ts';
import { main as evaluateMain } from '../../cli/runtime-envelope-evaluate.ts';
import { main as historyMain } from '../../cli/runtime-envelope-history.ts';
import { main as inspectMain } from '../../cli/runtime-envelope-inspect.ts';
import { main as listMain } from '../../cli/runtime-envelope-list.ts';
import { main as materializeMain } from '../../cli/runtime-envelope-materialize.ts';
import { main as rejectMain } from '../../cli/runtime-envelope-reject.ts';
import { main as statusMain } from '../../cli/runtime-envelope-status.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-runtime-envelope-cli');

const {
  listRuntimeEnvelopes,
  inspectRuntimeEnvelope,
  runtimeEnvelopeStatus,
  runtimeEnvelopeHistory,
  materializeRuntimeEnvelope,
  evaluateRuntimeEnvelope,
  confirmRuntimeEnvelope,
  rejectRuntimeEnvelope,
} = vi.hoisted(() => ({
  listRuntimeEnvelopes: vi.fn(() => [{ runtimeEnvelopeId: 're-1', executionContractId: 'ec-1' }]),
  inspectRuntimeEnvelope: vi.fn(() => ({ runtimeEnvelopeId: 're-1', executionContractId: 'ec-1' })),
  runtimeEnvelopeStatus: vi.fn(() => ({ runtimeEnvelopeId: 're-1', envelopeState: 'evaluated' })),
  runtimeEnvelopeHistory: vi.fn(() => ({ runtimeEnvelopeId: 're-1', entries: [] })),
  materializeRuntimeEnvelope: vi.fn(() => ({ runtimeEnvelopeId: 're-1' })),
  evaluateRuntimeEnvelope: vi.fn(() => ({ runtimeEnvelopeId: 're-1' })),
  confirmRuntimeEnvelope: vi.fn(() => ({ runtimeEnvelopeId: 're-1', envelopeState: 'ready_for_runtime' })),
  rejectRuntimeEnvelope: vi.fn(() => ({ runtimeEnvelopeId: 're-1', envelopeState: 'rejected' })),
}));

vi.mock('../../runtime-envelope/runtime-envelope-inspection.ts', () => ({
  createRuntimeEnvelopeInspection: vi.fn(() => ({
    listRuntimeEnvelopes,
    inspectRuntimeEnvelope,
    runtimeEnvelopeStatus,
    runtimeEnvelopeHistory,
    materializeRuntimeEnvelope,
    evaluateRuntimeEnvelope,
    confirmRuntimeEnvelope,
    rejectRuntimeEnvelope,
  })),
}));

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime envelope CLI commands', () => {
  it('T-MRE-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listRuntimeEnvelopes())}\n`);
    stdout.mockRestore();
  });

  it('T-MRE-CLI2 inspect requires --envelope', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --envelope');
    stdout.mockRestore();
  });

  it('T-MRE-CLI3 status routes envelope argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--envelope', 're-1']);

    expect(code).toBe(0);
    expect(runtimeEnvelopeStatus).toHaveBeenCalledWith({ runtimeEnvelopeId: 're-1' });
    stdout.mockRestore();
  });

  it('T-MRE-CLI4 history routes envelope argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--envelope=re-1']);

    expect(code).toBe(0);
    expect(runtimeEnvelopeHistory).toHaveBeenCalledWith({ runtimeEnvelopeId: 're-1' });
    stdout.mockRestore();
  });

  it('T-MRE-CLI5 evaluate and confirm route envelope argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const evalCode = await evaluateMain(['--envelope', 're-1']);
    const confirmCode = await confirmMain(['--envelope', 're-1']);

    expect(evalCode).toBe(0);
    expect(confirmCode).toBe(0);
    expect(evaluateRuntimeEnvelope).toHaveBeenCalledWith({ runtimeEnvelopeId: 're-1' });
    expect(confirmRuntimeEnvelope).toHaveBeenCalledWith({ runtimeEnvelopeId: 're-1' });
    stdout.mockRestore();
  });

  it('T-MRE-CLI6 materialize routes envelope argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--envelope', 're-1']);

    expect(code).toBe(0);
    expect(materializeRuntimeEnvelope).toHaveBeenCalledWith({ runtimeEnvelopeId: 're-1' });
    stdout.mockRestore();
  });

  it('T-MRE-CLI7 reject reads reason file and routes payload', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const reasonFile = path.join(tmpRoot, 'reason.txt');
    fs.writeFileSync(reasonFile, 'manual rejection rationale\n', 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await rejectMain([
      '--envelope',
      're-1',
      '--reason-file',
      reasonFile,
      '--reviewed-by',
      'founder',
    ]);

    expect(code).toBe(0);
    expect(rejectRuntimeEnvelope).toHaveBeenCalledWith({
      runtimeEnvelopeId: 're-1',
      reason: 'manual rejection rationale',
      reviewedBy: 'founder',
    });
    stdout.mockRestore();
  });

  it('T-MRE-CLI8 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectRuntimeEnvelope.mockImplementationOnce(() => {
      throw new Error('RUNTIME_ENVELOPE_NOT_FOUND');
    });

    const code = await inspectMain(['--envelope', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'RUNTIME_ENVELOPE_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
