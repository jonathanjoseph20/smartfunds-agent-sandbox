import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalEmitter } from '../signals/signal-emitter.ts';

import { createSynthesisInspection } from './synthesis-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-synthesis-projection');

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

describe('synthesis projection', () => {
  it('T-SYN-P1 projection computes deterministic state and creates no artifacts', () => {
    const scope = 'projection-only';
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    const inspection = createInspection(scope);
    const list = inspection.listSynthesisSets();
    expect(list.length).toBeGreaterThan(0);

    const projection = inspection.projectSynthesis(list[0]!.synthesisId);
    const projectionAgain = inspection.projectSynthesis(list[0]!.synthesisId);

    expect(projection).toEqual(projectionAgain);

    const reportPath = path.join(tmpRoot, scope, 'artifacts', 'syntheses', list[0]!.synthesisId, 'synthesis-report.json');
    expect(fs.existsSync(reportPath)).toBe(false);
  });
});
