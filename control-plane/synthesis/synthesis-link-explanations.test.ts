import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInvestigationStore } from '../investigations/investigation-store.ts';
import { createSignalStore } from '../signals/signal-store.ts';

import { createSynthesisLinkExplanations } from './synthesis-link-explanations.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-synthesis-link-explanations');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedDefinition(definitionsDir: string): void {
  writeJson(path.join(definitionsDir, 'protocol-risk.json'), {
    synthesisType: 'protocol-risk-synthesis',
    description: 'Protocol risk synthesis.',
    supportedDimensions: ['protocol', 'asset', 'trigger_family', 'signal_type'],
    sourceSignalTypes: ['protocol_risk'],
    sourceInvestigationDefinitionIds: ['protocol-risk-investigation']
  });
}

function seedInvestigation(rootDir: string, runId: string, signalRef: string): void {
  const store = createInvestigationStore({ rootDir });
  store.appendEvent({
    logDate: '2026-03-10',
    event: {
      eventType: 'INVESTIGATION_CREATED',
      investigationRunId: runId,
      dedupeKey: `dedupe-${runId}`,
      investigationDefinitionId: 'protocol-risk-investigation',
      sourceSignalReference: signalRef,
      sourceSignalType: 'protocol_risk',
      sourceTriggerId: 'protocol-risk-investigation',
      sourceTriggerReference: `trigger:protocol-risk-investigation:${signalRef}:slot-1`,
      slot: 'slot-1',
      logDate: '2026-03-10',
      associatedMissionReferences: ['defi-governance-events']
    }
  });
}

function seedSignal(rootDir: string, dedupeKey: string): void {
  const store = createSignalStore({ rootDir });
  store.appendSignal({
    signalType: 'protocol_risk',
    sourceMission: 'defi-governance-events',
    dataset: 'protocol_risk_feed',
    metadata: {
      protocol: 'Aave',
      asset: 'USDC',
      eventFamily: 'protocol-risk'
    },
    slot: 'slot-1',
    dedupeKey,
    logDate: '2026-03-10'
  });
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('synthesis link explanations', () => {
  it('T-SYN-LX1 produces deterministic metadata and definition-based reasons', () => {
    const defs = path.join(tmpRoot, 'defs');
    const investigationsRoot = path.join(tmpRoot, 'investigations');
    const signalsRoot = path.join(tmpRoot, 'signals');

    seedDefinition(defs);
    seedSignal(signalsRoot, 'sig-1');
    seedInvestigation(investigationsRoot, 'run-1', 'sig-1');

    const explanations = createSynthesisLinkExplanations({
      definitionsDir: defs,
      investigationsRootDir: investigationsRoot,
      signalsRootDir: signalsRoot
    }).explainLinksForSynthesis({
      synthesisId: 'syn-1',
      synthesisType: 'protocol-risk-synthesis',
      subjectKey: 'protocol:aave',
      linkedInvestigationIds: ['run-1']
    });

    expect(explanations).toEqual([
      {
        synthesisId: 'syn-1',
        linkedInvestigationId: 'run-1',
        subjectKey: 'protocol:aave',
        linkReasons: ['shared_protocol', 'synthesis_definition_match']
      }
    ]);
  });
});
