import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as createMain } from '../../cli/products-spec-create.ts';
import { main as inspectMain } from '../../cli/products-spec-inspect.ts';
import { main as listMain } from '../../cli/products-spec-list.ts';
import { main as materializeMain } from '../../cli/products-spec-materialize.ts';

const {
  createProductSpec,
  listProductSpecs,
  inspectProductSpec,
  materializeProductSpec,
  readFileSync,
} = vi.hoisted(() => ({
  createProductSpec: vi.fn(() => ({
    specId: 'spec-1',
    status: 'draft',
  })),
  listProductSpecs: vi.fn(() => ([
    { specId: 'spec-1', name: 'Spec One', status: 'draft' },
  ])),
  inspectProductSpec: vi.fn(() => ({
    specId: 'spec-1',
    name: 'Spec One',
    status: 'draft',
    validationState: 'valid',
    missingFields: [],
    warnings: [],
    originMissionIds: ['mission-1'],
  })),
  materializeProductSpec: vi.fn(() => ({
    specId: 'spec-1',
    productSpecPath: 'artifacts/products/spec-1/product-spec.json',
    statusPath: 'artifacts/products/spec-1/product-spec-status.json',
    validationPath: 'artifacts/products/spec-1/product-spec-validation.json',
    reportPath: 'artifacts/products/spec-1/product-spec-report.md',
  })),
  readFileSync: vi.fn(() => JSON.stringify({
    name: 'Spec One',
    problem: 'Problem One',
    targetUser: 'User One',
    solution: 'Solution One',
    mvpScope: 'MVP One',
    originMissionIds: ['mission-1'],
  })),
}));

vi.mock('../../products/product-spec-manager.ts', () => ({
  createProductSpecManager: vi.fn(() => ({
    createProductSpec,
    deriveProductSpecProjection: inspectProductSpec,
  })),
}));

vi.mock('../../products/product-spec-inspection.ts', () => ({
  createProductSpecInspection: vi.fn(() => ({
    listProductSpecs,
    inspectProductSpec,
  })),
}));

vi.mock('../../products/product-spec-materializer.ts', () => ({
  createProductSpecMaterializer: vi.fn(() => ({
    materializeProductSpec,
  })),
}));

vi.mock('node:fs', () => ({
  default: {
    readFileSync,
  },
}));

describe('product spec CLI', () => {
  it('T-PF1-CLI1 create/list/inspect/materialize output canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain(['--file', 'spec.json'])).toBe(0);
    expect(await listMain([])).toBe(0);
    expect(await inspectMain(['--spec', 'spec-1'])).toBe(0);
    expect(await materializeMain(['--spec', 'spec-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ specId: 'spec-1', status: 'draft' })}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify([{ specId: 'spec-1', name: 'Spec One', status: 'draft' }])}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectProductSpec())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeProductSpec())}\n`);

    stdout.mockRestore();
  });

  it('T-PF1-CLI2 returns code 1 with canonical error payload for input errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain([])).toBe(1);
    expect(await inspectMain([])).toBe(1);
    expect(await materializeMain([])).toBe(1);
    expect(await listMain(['--bad'])).toBe(1);

    const merged = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(merged).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --file' }));
    expect(merged).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --spec' }));
    expect(merged).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
