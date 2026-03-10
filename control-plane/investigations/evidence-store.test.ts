import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEvidenceStore } from './evidence-store.ts';
import type { EvidenceRecord } from './evidence-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-evidence-store');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('evidence store', () => {
  it('T-INV-EVD-S1 merges evidence idempotently with stable ordering', () => {
    const store = createEvidenceStore({ artifactsRoot: tmpRoot });
    const records: EvidenceRecord[] = [
      {
        evidenceId: 'b',
        investigationRunId: 'run-1',
        phaseId: 'gather',
        evidenceType: 'raw_observation',
        summary: 'b',
        payload: {},
        findingIds: ['f-1']
      },
      {
        evidenceId: 'a',
        investigationRunId: 'run-1',
        phaseId: 'analyze',
        evidenceType: 'derived_metric',
        summary: 'a',
        payload: {},
        findingIds: ['f-1']
      }
    ];

    store.mergeEvidence('run-1', records);
    store.mergeEvidence('run-1', records);

    const loaded = store.loadEvidence('run-1');
    expect(loaded.map((record) => record.evidenceId)).toEqual(['a', 'b']);

    const filePath = path.join(tmpRoot, 'run-1', 'evidence', 'evidence.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
  });
});
