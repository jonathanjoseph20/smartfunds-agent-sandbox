import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalEmitter } from '../signals/signal-emitter.ts';

import { createSynthesisInspection } from './synthesis-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-synthesis-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createInspection(scope: string) {
  const root = path.join(tmpRoot, scope);
  return createSynthesisInspection({
    synthesisArtifactsRoot: path.join(root, 'artifacts', 'syntheses'),
    investigationsRootDir: path.join(root, 'investigations'),
    signalsRootDir: path.join(root, 'signals'),
    investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations')
  });
}

function createEmitter(scope: string) {
  const root = path.join(tmpRoot, scope);
  return createSignalEmitter({
    signalsRootDir: path.join(root, 'signals'),
    triggersRootDir: path.join(root, 'triggers'),
    investigationsRootDir: path.join(root, 'investigations'),
    investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations')
  });
}

describe('synthesis materializer', () => {
  it('T-SYN-M1 materialization persists artifacts and does not mutate projection output', () => {
    const scope = 'materialize';
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    const inspection = createInspection(scope);
    const synthesisId = inspection.listSynthesisSets()[0]!.synthesisId;

    const before = inspection.projectSynthesis(synthesisId);
    const beforeSnapshot = JSON.stringify(before);

    const materialized = inspection.materializeSynthesis(synthesisId);

    const artifactDir = path.join(tmpRoot, scope, 'artifacts', 'syntheses', synthesisId);
    expect(fs.existsSync(path.join(artifactDir, 'synthesis-report.json'))).toBe(true);
    expect(fs.existsSync(path.join(artifactDir, 'synthesis-report.md'))).toBe(true);
    expect(fs.existsSync(path.join(artifactDir, 'synthesis-status.json'))).toBe(true);
    expect(fs.existsSync(path.join(artifactDir, 'synthesis-conflicts.json'))).toBe(true);
    expect(materialized.reportPath.endsWith('synthesis-report.json')).toBe(true);

    expect(JSON.stringify(before)).toBe(beforeSnapshot);

    const after = inspection.projectSynthesis(synthesisId);
    expect(after.status.readinessState).toBe('completed');
  });

  it('T-SYN-M2 materialization result is stable when no explicit operational slot is supplied', () => {
    const scope = 'materialize-stable';
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    const inspection = createInspection(scope);
    const synthesisId = inspection.listSynthesisSets()[0]!.synthesisId;

    const first = inspection.materializeSynthesis(synthesisId);
    const second = inspection.materializeSynthesis(synthesisId);

    expect(first).toEqual(second);
    expect('materializedAtSlot' in first).toBe(false);
  });
});
