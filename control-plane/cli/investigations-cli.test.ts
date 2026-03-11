import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as confidenceMain } from './investigations-confidence.ts';
import { main as historyMain } from './investigations-history.ts';
import { main as dueMain } from './investigations-due.ts';
import { main as evidenceMain } from './investigations-evidence.ts';
import { main as findingsMain } from './investigations-findings.ts';
import { main as inspectMain } from './investigations-inspect.ts';
import { main as listMain } from './investigations-list.ts';
import { main as deltaMain } from './investigations-delta.ts';
import { main as reportMain } from './investigations-report.ts';
import { main as revisionsMain } from './investigations-revisions.ts';
import { main as summaryMain } from './investigations-summary.ts';
import { main as trendMain } from './investigations-trend.ts';

const { listInvestigations, inspectInvestigation, historyByDate, readReport, listEvidence, inspectFindings, inspectConfidence, listRevisions, inspectLatestDelta, inspectTrend, inspectContinuitySummary } = vi.hoisted(() => ({
  listInvestigations: vi.fn(() => [{ investigationRunId: 'run-1', status: 'completed' }]),
  inspectInvestigation: vi.fn(() => ({ record: { investigationRunId: 'run-1' }, definition: {}, history: [] })),
  historyByDate: vi.fn(() => [{ date: '2026-03-10', investigations: [] }]),
  readReport: vi.fn(() => ({ reportPath: 'artifacts/investigations/run-1/investigation-report.md', content: '# Investigation Report\n' })),
  listEvidence: vi.fn(() => [{ evidenceId: 'e1' }]),
  inspectFindings: vi.fn(() => [{ findingId: 'f1' }]),
  inspectConfidence: vi.fn(() => ({ reportConfidence: { confidenceBand: 'medium' } })),
  listRevisions: vi.fn(() => [{ revisionId: 'revision-0001', revisionNumber: 1 }]),
  inspectLatestDelta: vi.fn(() => ({ revisionId: 'revision-0002', delta: { deltas: [] } })),
  inspectTrend: vi.fn(() => ({ confidenceTrend: 'improving' })),
  inspectContinuitySummary: vi.fn(() => ({ continuityState: 'evolving', confidenceTrend: 'mixed', revisionCount: 2, unresolvedLimitations: [] }))
}));
const { listDueInvestigations } = vi.hoisted(() => ({
  listDueInvestigations: vi.fn(() => [{ investigationRunId: 'run-1', dueNow: true, dueReason: 'due' }])
}));

vi.mock('../investigations/investigation-inspection.ts', () => ({
  createInvestigationInspection: vi.fn(() => ({
    listInvestigations,
    inspectInvestigation,
    historyByDate,
    readReport,
    listEvidence,
    inspectFindings,
    inspectConfidence,
    listRevisions,
    inspectLatestDelta,
    inspectTrend,
    inspectContinuitySummary
  }))
}));

vi.mock('../investigations/investigation-scheduler.ts', () => ({
  createInvestigationScheduler: vi.fn(() => ({
    listDueInvestigations
  }))
}));

describe('investigations CLI commands', () => {
  it('T-INV-CLI1 investigations:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listInvestigations())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI2 investigations:inspect requires --investigation', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --investigation');
    stdout.mockRestore();
  });

  it('T-INV-CLI3 investigations:inspect routes flag argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectInvestigation).toHaveBeenCalledWith('run-1');
    stdout.mockRestore();
  });

  it('T-INV-CLI4 investigations:history prints grouped history', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(historyByDate())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI6 investigations:history supports --investigation filter', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectInvestigation).toHaveBeenCalledWith('run-1');
    stdout.mockRestore();
  });

  it('T-INV-CLI5 investigations:report prints report body', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await reportMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith('# Investigation Report\n');
    stdout.mockRestore();
  });

  it('T-INV-CLI7 investigations:due prints deterministic due projection', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await dueMain(['--slot', 'interval_hours:6:2026-03-10T18:00Z']);

    expect(code).toBe(0);
    expect(listDueInvestigations).toHaveBeenCalledWith({ schedulerSlot: 'interval_hours:6:2026-03-10T18:00Z' });
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listDueInvestigations())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI8 investigations:evidence prints deterministic evidence projection', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await evidenceMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(listEvidence).toHaveBeenCalledWith('run-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listEvidence())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI9 investigations:confidence prints deterministic confidence projection', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await confidenceMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectConfidence).toHaveBeenCalledWith('run-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectConfidence())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI10 investigations:findings prints deterministic findings projection', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await findingsMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectFindings).toHaveBeenCalledWith('run-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectFindings())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI11 investigations:revisions prints deterministic revision history', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await revisionsMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(listRevisions).toHaveBeenCalledWith('run-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listRevisions())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI12 investigations:delta prints latest delta payload', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await deltaMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectLatestDelta).toHaveBeenCalledWith('run-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectLatestDelta())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI13 investigations:trend prints confidence trend', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await trendMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectTrend).toHaveBeenCalledWith('run-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectTrend())}\n`);
    stdout.mockRestore();
  });

  it('T-INV-CLI14 investigations:summary prints continuity summary', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await summaryMain(['--investigation', 'run-1']);

    expect(code).toBe(0);
    expect(inspectContinuitySummary).toHaveBeenCalledWith('run-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectContinuitySummary())}\n`);
    stdout.mockRestore();
  });
});
