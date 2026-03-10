import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { extractEvidenceRecords } from './evidence-extractor.ts';
import type { InvestigationEventRecord } from './investigation-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-evidence-extractor');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('evidence extractor', () => {
  it('T-INV-EVD1 extracts normalized evidence with deterministic ids and stable ordering', () => {
    const artifactPath = path.join(tmpRoot, 'gather-evidence.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify({
      dataset: 'protocol_tvl_timeseries',
      signalMetadata: { liquidityDropPercent: 12, protocol: 'Aave' },
      counterEvidence: ['counter-1'],
      unresolvedGaps: ['gap-1']
    }), 'utf8');

    const history: InvestigationEventRecord[] = [
      {
        sequence: 1,
        logDate: '2026-03-10',
        eventType: 'PHASE_COMPLETED',
        investigationRunId: 'run-1',
        phaseId: 'intake',
        phaseKind: 'intake',
        findings: ['finding-1']
      },
      {
        sequence: 2,
        logDate: '2026-03-10',
        eventType: 'PHASE_COMPLETED',
        investigationRunId: 'run-1',
        phaseId: 'gather',
        phaseKind: 'gather',
        findings: ['finding-1']
      }
    ];

    const first = extractEvidenceRecords({
      investigationRunId: 'run-1',
      phaseId: 'gather',
      artifactPaths: [artifactPath],
      findings: ['finding-1'],
      history
    });
    const second = extractEvidenceRecords({
      investigationRunId: 'run-1',
      phaseId: 'gather',
      artifactPaths: [artifactPath],
      findings: ['finding-1'],
      history
    });

    expect(first).toEqual(second);
    expect(first.some((record) => record.evidenceType === 'cross_cycle_confirmation')).toBe(true);

    const sorted = [...first].sort((left, right) => {
      const typeCmp = left.evidenceType.localeCompare(right.evidenceType);
      if (typeCmp !== 0) {
        return typeCmp;
      }
      const phaseCmp = left.phaseId.localeCompare(right.phaseId);
      if (phaseCmp !== 0) {
        return phaseCmp;
      }
      return left.evidenceId.localeCompare(right.evidenceId);
    });
    expect(first).toEqual(sorted);
  });
});
