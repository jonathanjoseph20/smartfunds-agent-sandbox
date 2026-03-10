import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createArtifactAccumulator } from './artifact-accumulator.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-accumulator');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('artifact accumulator', () => {
  it('T-A1 accumulates artifacts and updates dataset deterministically', () => {
    const artifactsRoot = path.join(tmpRoot, 'artifacts');
    writeJson(path.join(artifactsRoot, 'defi-yield-report', 'run_1', 'yield-report-json.json'), {
      entries: [
        { protocol: 'Aave', yield: '5.2%', change24h: '+0.2%' },
        { protocol: 'Morpho', yield: '6.1%', change24h: '-0.1%' }
      ]
    });

    const accumulator = createArtifactAccumulator({ artifactsRoot });

    const first = accumulator.accumulateLaunch({
      launch: {
        scheduleId: 'defi-yield-hourly-scan',
        missionId: 'defi-yield-report',
        slotId: 'interval_hours:6:2026-03-10T12:00Z',
        dueDecision: 'due',
        launched: true,
        runId: 'run_1',
        attemptedAtUtc: '2026-03-10T12:01:00.000Z'
      },
      team: {
        teamId: 'defi-intelligence',
        missionPackId: 'defi-intelligence',
        description: 'team'
      },
      pack: {
        packId: 'defi-intelligence',
        teamId: 'defi-intelligence',
        schedules: ['defi-yield-hourly-scan'],
        artifactNamespaces: {
          'defi-yield-hourly-scan': 'yield-snapshots'
        }
      }
    });

    expect(first.processed).toBe(true);
    expect(first.updatedDatasets).toEqual(['yield_rate_history']);

    const second = accumulator.accumulateLaunch({
      launch: {
        scheduleId: 'defi-yield-hourly-scan',
        missionId: 'defi-yield-report',
        slotId: 'interval_hours:6:2026-03-10T12:00Z',
        dueDecision: 'due',
        launched: true,
        runId: 'run_1',
        attemptedAtUtc: '2026-03-10T12:01:00.000Z'
      },
      team: {
        teamId: 'defi-intelligence',
        missionPackId: 'defi-intelligence',
        description: 'team'
      },
      pack: {
        packId: 'defi-intelligence',
        teamId: 'defi-intelligence',
        schedules: ['defi-yield-hourly-scan'],
        artifactNamespaces: {
          'defi-yield-hourly-scan': 'yield-snapshots'
        }
      }
    });

    expect(second.processed).toBe(false);

    const dataset = accumulator.readDataset({
      teamId: 'defi-intelligence',
      datasetKey: 'yield_rate_history'
    });

    expect(dataset.records).toHaveLength(2);
    expect(accumulator.listDatasets('defi-intelligence')).toEqual(['yield_rate_history']);
  });

  it('T-A2 does not process failed or missing-run launches', () => {
    const artifactsRoot = path.join(tmpRoot, 'artifacts');
    const accumulator = createArtifactAccumulator({ artifactsRoot });

    const result = accumulator.accumulateLaunch({
      launch: {
        scheduleId: 'defi-yield-hourly-scan',
        missionId: 'defi-yield-report',
        slotId: 'interval_hours:6:2026-03-10T18:00Z',
        dueDecision: 'due',
        launched: false,
        attemptedAtUtc: '2026-03-10T18:01:00.000Z',
        launchError: 'failed'
      },
      team: {
        teamId: 'defi-intelligence',
        missionPackId: 'defi-intelligence',
        description: 'team'
      },
      pack: {
        packId: 'defi-intelligence',
        teamId: 'defi-intelligence',
        schedules: ['defi-yield-hourly-scan']
      }
    });

    expect(result.processed).toBe(false);
    expect(result.updatedDatasets).toEqual([]);
  });
});
