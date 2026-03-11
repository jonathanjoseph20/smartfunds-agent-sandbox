import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCohortProgramInspection } from './program-inspection.ts';
import { createCohortProgramMaterializer } from './program-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-cohort-program-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('cohort program materializer', () => {
  it('T-CP-MAT1 materialization writes stable artifacts and preserves projection semantics', () => {
    const scope = 'stable';
    const root = path.join(tmpRoot, scope);
    const inspection = createCohortProgramInspection({
      cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts'),
      investigationArtifactsRoot: path.join(root, 'artifacts', 'investigations'),
      investigationsRootDir: path.join(root, 'investigations'),
      signalsRootDir: path.join(root, 'signals')
    });

    inspection.runProgram({
      programId: 'aave-risk-monitor',
      slot: 'daily:2026-03-11'
    });

    const statusBefore = inspection.inspectProgramStatus({
      cohortId: 'aave-risk',
      slot: 'daily:2026-03-11'
    });

    const materializer = createCohortProgramMaterializer({
      inspection,
      cohortArtifactsRoot: path.join(root, 'artifacts', 'cohorts')
    });

    const first = materializer.materializeCohortPrograms({
      cohortId: 'aave-risk',
      slot: 'daily:2026-03-11'
    });
    const second = materializer.materializeCohortPrograms({
      cohortId: 'aave-risk',
      slot: 'daily:2026-03-11'
    });

    const statusAfter = inspection.inspectProgramStatus({
      cohortId: 'aave-risk',
      slot: 'daily:2026-03-11'
    });

    expect(statusAfter).toEqual(statusBefore);
    expect(first).toEqual(second);

    const firstItem = first[0];
    if (!firstItem) {
      throw new Error('expected materialized program');
    }

    const statusJsonFirst = fs.readFileSync(firstItem.statusJsonPath, 'utf8');
    const historyJsonFirst = fs.readFileSync(firstItem.historyJsonPath, 'utf8');
    const reportMdFirst = fs.readFileSync(firstItem.reportMarkdownPath, 'utf8');

    const statusJsonSecond = fs.readFileSync(second[0]!.statusJsonPath, 'utf8');
    const historyJsonSecond = fs.readFileSync(second[0]!.historyJsonPath, 'utf8');
    const reportMdSecond = fs.readFileSync(second[0]!.reportMarkdownPath, 'utf8');

    expect(statusJsonFirst).toBe(statusJsonSecond);
    expect(historyJsonFirst).toBe(historyJsonSecond);
    expect(reportMdFirst).toBe(reportMdSecond);
  });
});
