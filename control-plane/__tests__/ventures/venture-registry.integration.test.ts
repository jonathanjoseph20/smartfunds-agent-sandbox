import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createVentureInspection } from '../../ventures/venture-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-venture-registry-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('venture registry integration', () => {
  it('T-VRI1 deterministic full flow from definition to materialization', () => {
    const inspection = createVentureInspection({ artifactsRoot: path.join(tmpRoot, 'artifacts', 'ventures') });

    const listed = inspection.listVentures();
    expect(listed.length).toBeGreaterThanOrEqual(4);

    const ventureId = listed.find((entry) => entry.ventureSlug === 'smartfunds-core')?.ventureId;
    expect(ventureId).toBeDefined();

    const projection = inspection.inspectVenture(ventureId as string);
    const status = inspection.getVentureStatus(ventureId as string);
    const history = inspection.getVentureHistory(ventureId as string);

    expect(projection.ventureId).toBe(ventureId as string);
    expect(status.ventureId).toBe(ventureId as string);
    expect(history.ventureId).toBe(ventureId as string);

    const firstMaterialized = inspection.materializeVenture(ventureId as string);
    const firstStatus = fs.readFileSync(firstMaterialized.statusPath, 'utf8');
    const firstHistory = fs.readFileSync(firstMaterialized.historyPath, 'utf8');
    const firstReport = fs.readFileSync(firstMaterialized.reportPath, 'utf8');

    const secondMaterialized = inspection.materializeVenture(ventureId as string);
    const secondStatus = fs.readFileSync(secondMaterialized.statusPath, 'utf8');
    const secondHistory = fs.readFileSync(secondMaterialized.historyPath, 'utf8');
    const secondReport = fs.readFileSync(secondMaterialized.reportPath, 'utf8');

    expect(secondStatus).toBe(firstStatus);
    expect(secondHistory).toBe(firstHistory);
    expect(secondReport).toBe(firstReport);
  });
});
