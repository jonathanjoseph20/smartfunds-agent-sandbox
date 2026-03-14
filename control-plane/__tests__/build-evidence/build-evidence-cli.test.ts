import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as createMain } from '../../cli/build-evidence-create.ts';
import { main as verifyMain } from '../../cli/build-evidence-verify.ts';
import { main as listMain } from '../../cli/build-evidence-list.ts';
import { main as inspectMain } from '../../cli/build-evidence-inspect.ts';
import { main as artifactsMain } from '../../cli/build-evidence-artifacts.ts';
import { main as promptMain } from '../../cli/build-evidence-prompt.ts';
import { main as planMain } from '../../cli/build-evidence-plan.ts';
import { main as statusMain } from '../../cli/build-evidence-status.ts';
import { main as historyMain } from '../../cli/build-evidence-history.ts';
import { main as materializeMain } from '../../cli/build-evidence-materialize.ts';

const {
  createEvidenceBundle,
  verifyEvidenceBundle,
  listEvidenceBundles,
  inspectEvidenceBundle,
  inspectArtifactVerification,
  inspectPromptAttestation,
  inspectExecutionPlanAttestation,
  inspectGovernanceValidation,
  inspectEvidenceHistory,
  materializeEvidenceBundle,
} = vi.hoisted(() => ({
  createEvidenceBundle: vi.fn(() => ({ buildEvidenceBundleId: 'be-1', runId: 'run-1', packetId: 'packet-1', bundleId: 'bundle-1' })),
  verifyEvidenceBundle: vi.fn(() => ({ buildEvidenceBundleId: 'be-1', verificationStatus: 'verified', outcome: 'verified' })),
  listEvidenceBundles: vi.fn(() => ([{ buildEvidenceBundleId: 'be-1', runId: 'run-1' }])),
  inspectEvidenceBundle: vi.fn(() => ({ buildEvidenceBundleId: 'be-1', runId: 'run-1' })),
  inspectArtifactVerification: vi.fn(() => ([{ artifactVerificationId: 'av-1' }])),
  inspectPromptAttestation: vi.fn(() => ({ promptAttestationId: 'pa-1' })),
  inspectExecutionPlanAttestation: vi.fn(() => ({ executionPlanAttestationId: 'ea-1' })),
  inspectGovernanceValidation: vi.fn(() => ({ verificationStatus: 'verified' })),
  inspectEvidenceHistory: vi.fn(() => ([{ eventType: 'build_evidence_bundle_created' }])),
  materializeEvidenceBundle: vi.fn(() => ({ buildEvidenceBundleId: 'be-1', dirPath: 'artifacts/build-evidence/be-1' })),
}));

vi.mock('../../build-evidence/build-evidence-inspection.ts', () => ({
  createBuildEvidenceInspection: vi.fn(() => ({
    createEvidenceBundle,
    verifyEvidenceBundle,
    listEvidenceBundles,
    inspectEvidenceBundle,
    inspectArtifactVerification,
    inspectPromptAttestation,
    inspectExecutionPlanAttestation,
    inspectGovernanceValidation,
    inspectEvidenceHistory,
    materializeEvidenceBundle,
  })),
}));

describe('build evidence CLI', () => {
  it('T-PF7-CLI1 commands print canonical JSON outputs', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain(['--run', 'run-1'])).toBe(0);
    expect(await verifyMain(['--evidence', 'be-1'])).toBe(0);
    expect(await listMain([])).toBe(0);
    expect(await inspectMain(['--evidence', 'be-1'])).toBe(0);
    expect(await artifactsMain(['--evidence', 'be-1'])).toBe(0);
    expect(await promptMain(['--evidence', 'be-1'])).toBe(0);
    expect(await planMain(['--evidence', 'be-1'])).toBe(0);
    expect(await statusMain(['--evidence', 'be-1'])).toBe(0);
    expect(await historyMain(['--evidence', 'be-1'])).toBe(0);
    expect(await materializeMain(['--evidence', 'be-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(createEvidenceBundle())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(verifyEvidenceBundle())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listEvidenceBundles())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectEvidenceBundle())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectArtifactVerification())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectPromptAttestation())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectExecutionPlanAttestation())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectGovernanceValidation())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectEvidenceHistory())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeEvidenceBundle())}\n`);

    stdout.mockRestore();
  });

  it('T-PF7-CLI2 missing and unknown arguments return stable errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain([])).toBe(1);
    expect(await verifyMain([])).toBe(1);
    expect(await listMain(['--bad'])).toBe(1);

    const output = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --run' }));
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --evidence' }));
    expect(output).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
