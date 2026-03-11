import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInvestigationStore } from '../investigations/investigation-store.ts';
import { createSignalStore } from '../signals/signal-store.ts';

import { createSynthesisLinker } from './synthesis-linker.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-synthesis-linker');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedDefinition(definitionsDir: string): void {
  writeJson(path.join(definitionsDir, 'protocol-risk.json'), {
    synthesisType: 'protocol-risk-synthesis',
    description: 'Protocol risk synthesis.',
    supportedDimensions: ['protocol'],
    sourceSignalTypes: ['protocol_risk'],
    sourceInvestigationDefinitionIds: ['protocol-risk-investigation']
  });
}

function seedSignal(rootDir: string, input: { dedupeKey: string; protocol: string; slot: string }): void {
  const store = createSignalStore({ rootDir });
  store.appendSignal({
    signalType: 'protocol_risk',
    sourceMission: 'defi-governance-events',
    dataset: 'protocol_risk_feed',
    metadata: { protocol: input.protocol, riskLevel: 'high' },
    slot: input.slot,
    dedupeKey: input.dedupeKey,
    logDate: '2026-03-10'
  });
}

function seedInvestigation(rootDir: string, input: { runId: string; dedupeKey: string; signalRef: string; slot: string }): void {
  const store = createInvestigationStore({ rootDir });
  store.appendEvent({
    logDate: '2026-03-10',
    event: {
      eventType: 'INVESTIGATION_CREATED',
      investigationRunId: input.runId,
      dedupeKey: input.dedupeKey,
      investigationDefinitionId: 'protocol-risk-investigation',
      sourceSignalReference: input.signalRef,
      sourceSignalType: 'protocol_risk',
      sourceTriggerId: 'protocol-risk-investigation',
      sourceTriggerReference: `trigger:protocol-risk-investigation:${input.signalRef}:${input.slot}`,
      slot: input.slot,
      logDate: '2026-03-10',
      associatedMissionReferences: ['defi-governance-events']
    }
  });
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('synthesis linker', () => {
  it('T-SYN-L1 links investigations by same protocol deterministically', () => {
    const defs = path.join(tmpRoot, 'defs-1');
    const investigationsRoot = path.join(tmpRoot, 'investigations-1');
    const signalsRoot = path.join(tmpRoot, 'signals-1');

    seedDefinition(defs);
    seedSignal(signalsRoot, { dedupeKey: 'sig-1', protocol: 'Aave', slot: 'interval_hours:6:2026-03-10T12:00Z' });
    seedSignal(signalsRoot, { dedupeKey: 'sig-2', protocol: 'Aave', slot: 'interval_hours:6:2026-03-10T18:00Z' });
    seedInvestigation(investigationsRoot, {
      runId: 'run-b',
      dedupeKey: 'dedupe-b',
      signalRef: 'sig-2',
      slot: 'interval_hours:6:2026-03-10T18:00Z'
    });
    seedInvestigation(investigationsRoot, {
      runId: 'run-a',
      dedupeKey: 'dedupe-a',
      signalRef: 'sig-1',
      slot: 'interval_hours:6:2026-03-10T12:00Z'
    });

    const linker = createSynthesisLinker({ definitionsDir: defs, investigationsRootDir: investigationsRoot, signalsRootDir: signalsRoot });
    const links = linker.buildLinks();

    expect(links).toHaveLength(1);
    expect(links[0]?.subjectKey).toBe('protocol:aave');
    expect(links[0]?.linkedInvestigationIds).toEqual(['run-a', 'run-b']);
    expect(links[0]?.linkedReasons).toEqual([
      { dimension: 'protocol', value: 'aave', reason: 'same protocol=aave' }
    ]);
  });

  it('T-SYN-L2 unrelated protocols do not share the same synthesis set', () => {
    const defs = path.join(tmpRoot, 'defs-2');
    const investigationsRoot = path.join(tmpRoot, 'investigations-2');
    const signalsRoot = path.join(tmpRoot, 'signals-2');

    seedDefinition(defs);
    seedSignal(signalsRoot, { dedupeKey: 'sig-1', protocol: 'Aave', slot: 'interval_hours:6:2026-03-10T12:00Z' });
    seedSignal(signalsRoot, { dedupeKey: 'sig-2', protocol: 'Morpho', slot: 'interval_hours:6:2026-03-10T18:00Z' });
    seedInvestigation(investigationsRoot, { runId: 'run-a', dedupeKey: 'dedupe-a', signalRef: 'sig-1', slot: 'interval_hours:6:2026-03-10T12:00Z' });
    seedInvestigation(investigationsRoot, { runId: 'run-b', dedupeKey: 'dedupe-b', signalRef: 'sig-2', slot: 'interval_hours:6:2026-03-10T18:00Z' });

    const linker = createSynthesisLinker({ definitionsDir: defs, investigationsRootDir: investigationsRoot, signalsRootDir: signalsRoot });
    const links = linker.buildLinks();

    expect(links).toHaveLength(2);
    expect(links.map((entry) => entry.subjectKey)).toEqual(['protocol:aave', 'protocol:morpho']);
    expect(links.every((entry) => entry.linkedInvestigationIds.length === 1)).toBe(true);
  });

  it('T-SYN-L3 synthesis identity is stable for identical inputs', () => {
    const defs = path.join(tmpRoot, 'defs-3');
    const investigationsRoot = path.join(tmpRoot, 'investigations-3');
    const signalsRoot = path.join(tmpRoot, 'signals-3');

    seedDefinition(defs);
    seedSignal(signalsRoot, { dedupeKey: 'sig-1', protocol: 'Aave', slot: 'interval_hours:6:2026-03-10T12:00Z' });
    seedInvestigation(investigationsRoot, { runId: 'run-a', dedupeKey: 'dedupe-a', signalRef: 'sig-1', slot: 'interval_hours:6:2026-03-10T12:00Z' });

    const linker = createSynthesisLinker({ definitionsDir: defs, investigationsRootDir: investigationsRoot, signalsRootDir: signalsRoot });
    const first = linker.buildLinks();
    const second = linker.buildLinks();

    expect(first).toEqual(second);
    expect(first[0]?.synthesisId).toBe(second[0]?.synthesisId);
  });
});
