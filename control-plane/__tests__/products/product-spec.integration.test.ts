import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createProductSpecManager } from '../../products/product-spec-manager.ts';
import { createProductSpecMaterializer } from '../../products/product-spec-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'products', 'tmp-product-spec-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('product spec integration', () => {
  it('T-PF1-I1 runs create -> validate -> history -> projection -> materialize flow', () => {
    const manager = createProductSpecManager({
      specsFilePath: path.join(tmpRoot, 'state', 'product-specs.json'),
      historyFilePath: path.join(tmpRoot, 'state', 'product-spec-history.json'),
    });

    const created = manager.createProductSpec({
      name: 'Stratum Money Dashboard',
      problem: 'Users cannot inspect collateral ratios.',
      targetUser: 'Stratum ecosystem participants',
      solution: 'Transparency dashboard displaying reserves.',
      architectureSummary: 'React dashboard + API.',
      mvpScope: 'Dashboard with collateral ratios.',
      originMissionIds: ['mission-stratum-dashboard'],
    });

    expect(created.status).toBe('draft');

    const validated = manager.validateProductSpec(created.specId);
    expect(validated.status).toBe('validated');
    expect(validated.historyEvents.some((event) => event.eventType === 'product_spec_validated')).toBe(true);

    const projection = manager.deriveProductSpecProjection(created.specId);
    expect(projection.specId).toBe(created.specId);
    expect(projection.validationState).toBe('valid');

    const materializer = createProductSpecMaterializer({
      manager,
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'products'),
    });

    const materialized = materializer.materializeProductSpec(created.specId);
    expect(fs.existsSync(materialized.productSpecPath)).toBe(true);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.validationPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
  });
});
