import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalEmitter } from '../signals/signal-emitter.ts';

import { createCohortInspection } from './cohort-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-cohort-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createInspection(scope: string) {
  const root = path.join(tmpRoot, scope);
  return createCohortInspection({
    cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
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

describe('cohort materializer', () => {
  it('T-COH-M1 materialization preserves projected readiness and produces byte-stable artifacts across repeated runs', () => {
    const scope = 'stable';
    const emitter = createEmitter(scope);

    emitter.emitSignal('protocol_risk', {
      dataset: 'protocol_risk_feed',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      riskLevel: 'high'
    });

    const inspection = createInspection(scope);
    const statusBefore = inspection.inspectStatus('aave-risk');
    const projectedBefore = inspection.projectCohort('aave-risk');

    const first = inspection.materializeCohort('aave-risk');
    const firstJson = fs.readFileSync(first.reportPath, 'utf8');
    const mdPath = path.join(tmpRoot, scope, 'artifacts', 'cohorts', 'aave-risk', 'cohort-report.md');
    const firstMd = fs.readFileSync(mdPath, 'utf8');

    const statusAfterFirst = inspection.inspectStatus('aave-risk');
    const projectedAfterFirst = inspection.projectCohort('aave-risk');

    const second = inspection.materializeCohort('aave-risk');
    const secondJson = fs.readFileSync(second.reportPath, 'utf8');
    const secondMd = fs.readFileSync(mdPath, 'utf8');
    const statusAfterSecond = inspection.inspectStatus('aave-risk');
    const projectedAfterSecond = inspection.projectCohort('aave-risk');

    expect(statusAfterFirst).toEqual(statusBefore);
    expect(statusAfterSecond).toEqual(statusBefore);
    expect(projectedAfterFirst).toEqual(projectedBefore);
    expect(projectedAfterSecond).toEqual(projectedBefore);
    expect(first).toEqual(second);
    expect(firstJson).toBe(secondJson);
    expect(firstMd).toBe(secondMd);
  });
});
