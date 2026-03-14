import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as createMain } from '../../cli/repo-scaffold-create.ts';
import { main as inspectMain } from '../../cli/repo-scaffold-inspect.ts';
import { main as listMain } from '../../cli/repo-scaffold-list.ts';
import { main as materializeMain } from '../../cli/repo-scaffold-materialize.ts';

const {
  createRepoScaffoldBundles,
} = vi.hoisted(() => ({
  createRepoScaffoldBundles: vi.fn(() => ({
    bundleId: 'bundle-1',
    packetId: 'packet-1',
  })),
}));

const {
  listRepoScaffoldBundles,
  inspectRepoScaffoldBundle,
  materializeRepoScaffoldBundle,
} = vi.hoisted(() => ({
  listRepoScaffoldBundles: vi.fn(() => ([
    { bundleId: 'bundle-1', packetId: 'packet-1', status: 'ready' },
  ])),
  inspectRepoScaffoldBundle: vi.fn(() => ({
    bundle: { bundleId: 'bundle-1' },
    validation: { validationState: 'valid' },
    status: 'ready',
    projection: { bundleId: 'bundle-1', packetId: 'packet-1', status: 'ready' },
    fileLayout: { files: [] },
    patchPlan: { patchTargets: [] },
    history: [],
  })),
  materializeRepoScaffoldBundle: vi.fn(() => ({
    bundleId: 'bundle-1',
    dirPath: 'artifacts/repo-scaffold/bundle-1',
  })),
}));

vi.mock('../../repo-scaffold/repo-scaffold-manager.ts', () => ({
  createRepoScaffoldManager: vi.fn(() => ({
    createRepoScaffoldBundles,
  })),
}));

vi.mock('../../repo-scaffold/repo-scaffold-inspection.ts', () => ({
  createRepoScaffoldInspection: vi.fn(() => ({
    listRepoScaffoldBundles,
    inspectRepoScaffoldBundle,
    materializeRepoScaffoldBundle,
  })),
}));

describe('repo scaffold CLI', () => {
  it('T-PF5-CLI1 create/list/inspect/materialize output canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain(['--packet', 'packet-1'])).toBe(0);
    expect(await listMain([])).toBe(0);
    expect(await inspectMain(['--bundle', 'bundle-1'])).toBe(0);
    expect(await materializeMain(['--bundle', 'bundle-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ bundleId: 'bundle-1', packetId: 'packet-1' })}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listRepoScaffoldBundles())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectRepoScaffoldBundle())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeRepoScaffoldBundle())}\n`);

    stdout.mockRestore();
  });

  it('T-PF5-CLI2 missing argument errors return code 1 and canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain([])).toBe(1);
    expect(await inspectMain([])).toBe(1);
    expect(await materializeMain([])).toBe(1);
    expect(await listMain(['--bad'])).toBe(1);

    const output = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --packet' }));
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --bundle' }));
    expect(output).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
