import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as createMain } from '../../cli/product-factory-release-create.ts';
import { main as validateMain } from '../../cli/product-factory-release-validate.ts';
import { main as closeMain } from '../../cli/product-factory-release-close.ts';
import { main as inspectMain } from '../../cli/product-factory-release-inspect.ts';
import { main as lifecycleMain } from '../../cli/product-factory-release-lifecycle.ts';
import { main as replayMain } from '../../cli/product-factory-release-replay.ts';
import { main as docsMain } from '../../cli/product-factory-release-docs.ts';
import { main as hardeningMain } from '../../cli/product-factory-release-hardening.ts';
import { main as statusMain } from '../../cli/product-factory-release-status.ts';
import { main as historyMain } from '../../cli/product-factory-release-history.ts';
import { main as materializeMain } from '../../cli/product-factory-release-materialize.ts';

const {
  createReleaseAcceptance,
  validateReleaseAcceptance,
  closeReleaseAcceptance,
  inspectReleaseAcceptanceRecord,
  inspectLifecycleAcceptance,
  inspectReplayValidation,
  inspectDocsCompleteness,
  inspectReleaseHardening,
  inspectReleaseStatus,
  inspectReleaseHistory,
  materializeReleaseAcceptance,
} = vi.hoisted(() => ({
  createReleaseAcceptance: vi.fn(() => ({ productFactoryReleaseAcceptanceRecordId: 'release-1', releaseTrack: 'track-1' })),
  validateReleaseAcceptance: vi.fn(() => ({ productFactoryReleaseAcceptanceRecordId: 'release-1', status: 'validating' })),
  closeReleaseAcceptance: vi.fn(() => ({ productFactoryReleaseAcceptanceRecordId: 'release-1', status: 'closed' })),
  inspectReleaseAcceptanceRecord: vi.fn(() => ({ productFactoryReleaseAcceptanceRecordId: 'release-1' })),
  inspectLifecycleAcceptance: vi.fn(() => ({ acceptanceClass: 'lifecycle_complete' })),
  inspectReplayValidation: vi.fn(() => ({ validationClass: 'replay_validated' })),
  inspectDocsCompleteness: vi.fn(() => ({ completenessClass: 'docs_complete' })),
  inspectReleaseHardening: vi.fn(() => ({ hardeningClass: 'hardened' })),
  inspectReleaseStatus: vi.fn(() => ({ status: 'acceptance_ready' })),
  inspectReleaseHistory: vi.fn(() => ([{ eventType: 'product_factory_release_closed' }])),
  materializeReleaseAcceptance: vi.fn(() => ({ productFactoryReleaseAcceptanceRecordId: 'release-1', dirPath: 'artifacts/product-factory-release/release-1' })),
}));

vi.mock('../../product-factory-release/product-factory-release-inspection.ts', () => ({
  createProductFactoryReleaseInspection: vi.fn(() => ({
    createReleaseAcceptance,
    validateReleaseAcceptance,
    closeReleaseAcceptance,
    inspectReleaseAcceptanceRecord,
    inspectLifecycleAcceptance,
    inspectReplayValidation,
    inspectDocsCompleteness,
    inspectReleaseHardening,
    inspectReleaseStatus,
    inspectReleaseHistory,
    materializeReleaseAcceptance,
  })),
}));

describe('product factory release cli', () => {
  it('T-PF9-CLI1 required commands output canonical json', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain(['--track', 'track-1', '--intent', 'intent-1'])).toBe(0);
    expect(await validateMain(['--release', 'release-1'])).toBe(0);
    expect(await closeMain(['--release', 'release-1'])).toBe(0);
    expect(await inspectMain(['--release', 'release-1'])).toBe(0);
    expect(await lifecycleMain(['--release', 'release-1'])).toBe(0);
    expect(await replayMain(['--release', 'release-1'])).toBe(0);
    expect(await docsMain(['--release', 'release-1'])).toBe(0);
    expect(await hardeningMain(['--release', 'release-1'])).toBe(0);
    expect(await statusMain(['--release', 'release-1'])).toBe(0);
    expect(await historyMain(['--release', 'release-1'])).toBe(0);
    expect(await materializeMain(['--release', 'release-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(createReleaseAcceptance())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(validateReleaseAcceptance())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(closeReleaseAcceptance())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectReleaseAcceptanceRecord())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectLifecycleAcceptance())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectReplayValidation())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectDocsCompleteness())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectReleaseHardening())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectReleaseStatus())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectReleaseHistory())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeReleaseAcceptance())}\n`);

    stdout.mockRestore();
  });

  it('T-PF9-CLI2 missing and unknown args return stable errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain([])).toBe(1);
    expect(await validateMain([])).toBe(1);
    expect(await inspectMain(['--bad'])).toBe(1);

    const output = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --track' }));
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --release' }));
    expect(output).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
