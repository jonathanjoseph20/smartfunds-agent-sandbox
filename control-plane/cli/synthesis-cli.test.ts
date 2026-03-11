import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as conflictsMain } from './synthesis-conflicts.ts';
import { main as confidenceMain } from './synthesis-confidence.ts';
import { main as inspectMain } from './synthesis-inspect.ts';
import { main as linksMain } from './synthesis-links.ts';
import { main as listMain } from './synthesis-list.ts';
import { main as materializeMain } from './synthesis-materialize.ts';
import { main as projectMain } from './synthesis-project.ts';
import { main as reportMain } from './synthesis-report.ts';
import { main as statusMain } from './synthesis-status.ts';
import { main as whyMain } from './synthesis-why.ts';

const {
  listSynthesisSets,
  inspectSynthesis,
  inspectLinks,
  inspectConfidence,
  readReport,
  inspectStatus,
  inspectWhy,
  inspectConflicts,
  projectSynthesis,
  materializeSynthesis
} = vi.hoisted(() => ({
  listSynthesisSets: vi.fn(() => [{
    synthesisId: 'syn-1',
    synthesisType: 'protocol-risk-synthesis',
    subjectKey: 'protocol:aave',
    status: 'completed',
    linkedInvestigationCount: 2,
    confidenceBand: 'high',
    artifactPaths: ['artifacts/synthesis/syn-1/synthesis-report.json']
  }]),
  inspectSynthesis: vi.fn(() => ({ synthesisId: 'syn-1', status: 'completed', findings: [] })),
  inspectLinks: vi.fn(() => ({ synthesisId: 'syn-1', linkedInvestigationIds: ['run-1'], linkedReasons: [] })),
  inspectConfidence: vi.fn(() => ({
    synthesisId: 'syn-1',
    confidence: {
      overallBand: 'high',
      supportingFactors: ['linked investigations: 2'],
      weakeningFactors: [],
      unresolvedConflicts: []
    }
  })),
  readReport: vi.fn(() => ({ reportPath: 'artifacts/synthesis/syn-1/synthesis-report.md', content: '# Cross-Investigation Synthesis Report\n' })),
  inspectStatus: vi.fn(() => ({ synthesisId: 'syn-1', readinessState: 'ready', blockingReasons: [] })),
  inspectWhy: vi.fn(() => ({
    synthesisId: 'syn-1',
    explanations: [{ synthesisId: 'syn-1', linkedInvestigationId: 'run-1', subjectKey: 'protocol:aave', linkReasons: ['shared_protocol'] }]
  })),
  inspectConflicts: vi.fn(() => ({ synthesisId: 'syn-1', conflicts: [] })),
  projectSynthesis: vi.fn(() => ({ synthesisId: 'syn-1', status: { readinessState: 'ready' }, conflicts: [], reportPreview: {} })),
  materializeSynthesis: vi.fn(() => ({ synthesisId: 'syn-1', reportPath: 'artifacts/syntheses/syn-1/synthesis-report.json' }))
}));

vi.mock('../synthesis/synthesis-inspection.ts', () => ({
  createSynthesisInspection: vi.fn(() => ({
    listSynthesisSets,
    inspectSynthesis,
    inspectLinks,
    inspectConfidence,
    readReport,
    inspectStatus,
    inspectWhy,
    inspectConflicts,
    projectSynthesis,
    materializeSynthesis
  }))
}));

describe('synthesis CLI commands', () => {
  it('T-SYN-CLI1 synthesis:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listSynthesisSets())}\n`);
    stdout.mockRestore();
  });

  it('T-SYN-CLI2 synthesis:inspect requires --synthesis', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --synthesis');
    stdout.mockRestore();
  });

  it('T-SYN-CLI3 synthesis:inspect routes flag argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(inspectSynthesis).toHaveBeenCalledWith('syn-1');
    stdout.mockRestore();
  });

  it('T-SYN-CLI4 synthesis:links prints deterministic links projection', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await linksMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(inspectLinks).toHaveBeenCalledWith('syn-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectLinks())}\n`);
    stdout.mockRestore();
  });

  it('T-SYN-CLI5 synthesis:confidence prints deterministic confidence projection', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await confidenceMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(inspectConfidence).toHaveBeenCalledWith('syn-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectConfidence())}\n`);
    stdout.mockRestore();
  });

  it('T-SYN-CLI6 synthesis:report prints markdown report body', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await reportMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(readReport).toHaveBeenCalledWith('syn-1');
    expect(stdout).toHaveBeenCalledWith('# Cross-Investigation Synthesis Report\n');
    stdout.mockRestore();
  });

  it('T-SYN-CLI7 synthesis:status prints readiness projection', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(inspectStatus).toHaveBeenCalledWith('syn-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectStatus())}\n`);
    stdout.mockRestore();
  });

  it('T-SYN-CLI8 synthesis:why prints deterministic link explanations', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await whyMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(inspectWhy).toHaveBeenCalledWith('syn-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectWhy())}\n`);
    stdout.mockRestore();
  });

  it('T-SYN-CLI9 synthesis:conflicts prints classified conflicts', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await conflictsMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(inspectConflicts).toHaveBeenCalledWith('syn-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectConflicts())}\n`);
    stdout.mockRestore();
  });

  it('T-SYN-CLI10 synthesis:project returns projection without materialization', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await projectMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(projectSynthesis).toHaveBeenCalledWith('syn-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(projectSynthesis())}\n`);
    stdout.mockRestore();
  });

  it('T-SYN-CLI11 synthesis:materialize persists artifacts explicitly', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--synthesis', 'syn-1']);

    expect(code).toBe(0);
    expect(materializeSynthesis).toHaveBeenCalledWith('syn-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeSynthesis())}\n`);
    stdout.mockRestore();
  });
});
