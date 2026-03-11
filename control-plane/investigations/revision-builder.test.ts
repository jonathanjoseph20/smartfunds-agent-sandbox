import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInvestigationRevisionBuilder } from './investigation-revision-builder.ts';
import { createInvestigationRevisionStore } from './investigation-revision-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-investigation-revision-builder');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function finding(findingId: string, confidenceBand: 'low' | 'medium' | 'high', support = 1, counter = 0, gaps = 0) {
  return {
    findingId,
    title: findingId,
    summary: findingId,
    supportingEvidenceIds: Array.from({ length: support }, (_, index) => `${findingId}-s${String(index + 1)}`),
    counterEvidenceIds: Array.from({ length: counter }, (_, index) => `${findingId}-c${String(index + 1)}`),
    unresolvedGapIds: Array.from({ length: gaps }, (_, index) => `${findingId}-g${String(index + 1)}`),
    confidenceBand,
    confidenceScore: confidenceBand === 'high' ? 80 : (confidenceBand === 'medium' ? 55 : 30),
    confidenceReason: 'deterministic-test',
    strengths: [],
    limitations: []
  };
}

describe('investigation revision builder', () => {
  it('T-INV-RB1 assigns deterministic monotonic revision numbers', () => {
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'investigations');
    const builder = createInvestigationRevisionBuilder({ artifactsRoot });

    const first = builder.createRevisionSnapshot({
      investigationRunId: 'run-1',
      slotReference: 'interval_hours:6:2026-03-10T12:00Z',
      reportPath: path.join(artifactsRoot, 'run-1', 'investigation-report.md'),
      findings: [finding('finding-a', 'medium')],
      reportConfidence: {
        confidenceBand: 'medium',
        confidenceScore: 55,
        confidenceReason: 'score=55 band=medium',
        strengths: [],
        limitations: []
      }
    });

    const second = builder.createRevisionSnapshot({
      investigationRunId: 'run-1',
      slotReference: 'interval_hours:6:2026-03-10T18:00Z',
      reportPath: path.join(artifactsRoot, 'run-1', 'investigation-report.md'),
      findings: [finding('finding-a', 'high', 2)],
      reportConfidence: {
        confidenceBand: 'high',
        confidenceScore: 75,
        confidenceReason: 'score=75 band=high',
        strengths: ['supporting evidence records: 2'],
        limitations: []
      }
    });

    expect(first.record.revisionId).toBe('revision-0001');
    expect(second.record.revisionId).toBe('revision-0002');
  });

  it('T-INV-RB2 preserves append-only prior revision artifacts', () => {
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'investigations');
    const builder = createInvestigationRevisionBuilder({ artifactsRoot });

    const first = builder.createRevisionSnapshot({
      investigationRunId: 'run-2',
      reportPath: path.join(artifactsRoot, 'run-2', 'investigation-report.md'),
      findings: [finding('finding-a', 'medium')],
      reportConfidence: {
        confidenceBand: 'medium',
        confidenceScore: 55,
        confidenceReason: 'score=55 band=medium',
        strengths: [],
        limitations: []
      }
    });

    const firstSummaryBefore = fs.readFileSync(path.join(first.revisionDir, 'revision-summary.json'), 'utf8');

    builder.createRevisionSnapshot({
      investigationRunId: 'run-2',
      reportPath: path.join(artifactsRoot, 'run-2', 'investigation-report.md'),
      findings: [finding('finding-a', 'medium', 2)],
      reportConfidence: {
        confidenceBand: 'medium',
        confidenceScore: 60,
        confidenceReason: 'score=60 band=medium',
        strengths: ['supporting evidence records: 2'],
        limitations: []
      }
    });

    const firstSummaryAfter = fs.readFileSync(path.join(first.revisionDir, 'revision-summary.json'), 'utf8');
    expect(firstSummaryAfter).toBe(firstSummaryBefore);
  });

  it('T-INV-RB3 persists revision snapshot artifacts deterministically', () => {
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'investigations');
    const builder = createInvestigationRevisionBuilder({ artifactsRoot });
    const store = createInvestigationRevisionStore({ artifactsRoot });

    const created = builder.createRevisionSnapshot({
      investigationRunId: 'run-3',
      reportPath: path.join(artifactsRoot, 'run-3', 'investigation-report.md'),
      findings: [finding('finding-a', 'low', 1, 1, 1)],
      reportConfidence: {
        confidenceBand: 'low',
        confidenceScore: 30,
        confidenceReason: 'score=30 band=low',
        strengths: [],
        limitations: ['counter-evidence records: 1', 'unresolved gaps: 1']
      }
    });

    const revisions = store.listRevisions('run-3');
    expect(revisions).toHaveLength(1);
    expect(fs.existsSync(path.join(created.revisionDir, 'revision-summary.json'))).toBe(true);
    expect(fs.existsSync(path.join(created.revisionDir, 'revision-summary.md'))).toBe(true);
    expect(fs.existsSync(path.join(created.revisionDir, 'findings-snapshot.json'))).toBe(true);
    expect(fs.existsSync(path.join(created.revisionDir, 'confidence-snapshot.json'))).toBe(true);
  });
});
