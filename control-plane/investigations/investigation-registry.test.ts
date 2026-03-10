import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInvestigationRegistry } from './investigation-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigations-registry');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('investigation registry', () => {
  it('T-INV-R1 loads seeded definitions in deterministic investigationDefinitionId order', () => {
    const registry = createInvestigationRegistry();

    expect(registry.listInvestigations().map((entry) => entry.investigationDefinitionId)).toEqual([
      'governance-proposal-investigation',
      'liquidity-drain-investigation',
      'protocol-risk-investigation',
      'yield-anomaly-investigation'
    ]);
  });

  it('T-INV-R2 rejects invalid phase ordering', () => {
    const defsDir = path.join(tmpRoot, 'definitions');
    writeJson(path.join(defsDir, 'invalid.json'), {
      investigationDefinitionId: 'broken-investigation',
      sourceSignalType: 'liquidity_drain',
      sourceTriggerId: 'broken-trigger',
      phases: [
        { phaseId: 'gather', kind: 'gather', requiredInputs: [], produces: [] }
      ],
      outputArtifacts: ['investigation-report.json'],
      completionCriteria: ['final_report_written'],
      dedupeStrategy: 'definition_signal_slot'
    });

    expect(() => createInvestigationRegistry({ definitionsDir: defsDir })).toThrow('phases must follow intake -> gather -> analyze -> synthesize -> finalize');
  });

  it('T-INV-R3 resolves matching definition by triggerId deterministically', () => {
    const registry = createInvestigationRegistry();
    const definition = registry.resolveInvestigation({
      triggerId: 'yield-anomaly-investigation',
      signalType: 'yield_anomaly'
    });

    expect(definition.investigationDefinitionId).toBe('yield-anomaly-investigation');
  });
});
