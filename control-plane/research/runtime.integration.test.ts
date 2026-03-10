import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createResearchRuntime } from './runtime.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-runtime');
const artifactsRoot = path.join(tmpRoot, 'artifacts');
const teamsDir = path.join(tmpRoot, 'teams');
const packsDir = path.join(tmpRoot, 'packs');
const scheduleRegistryPath = path.join(tmpRoot, 'scheduler-registry.json');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

beforeEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });

  writeJson(path.join(teamsDir, 'defi-intelligence.json'), {
    teamId: 'defi-intelligence',
    missionPackId: 'defi-intelligence',
    description: 'team',
    enabled: true
  });

  writeJson(path.join(packsDir, 'defi-intelligence.json'), {
    packId: 'defi-intelligence',
    teamId: 'defi-intelligence',
    schedules: [
      'defi-daily-market-brief',
      'defi-governance-hourly-scan',
      'defi-liquidity-hourly-scan',
      'defi-yield-hourly-scan'
    ],
    summaryScheduleId: 'defi-daily-market-brief',
    artifactNamespaces: {
      'defi-governance-hourly-scan': 'governance-events',
      'defi-liquidity-hourly-scan': 'liquidity-snapshots',
      'defi-yield-hourly-scan': 'yield-snapshots',
      'defi-daily-market-brief': 'daily-briefs'
    }
  });

  writeJson(scheduleRegistryPath, {
    schemaVersion: 1,
    schedules: [
      { scheduleId: 'defi-daily-market-brief', missionId: 'defi-daily-market-brief', enabled: true, cadence: { type: 'daily' } },
      { scheduleId: 'defi-governance-hourly-scan', missionId: 'defi-governance-events', enabled: true, cadence: { type: 'interval_hours', every: 6 } },
      { scheduleId: 'defi-liquidity-hourly-scan', missionId: 'defi-liquidity-scan', enabled: true, cadence: { type: 'interval_hours', every: 6 } },
      { scheduleId: 'defi-yield-hourly-scan', missionId: 'defi-yield-report', enabled: true, cadence: { type: 'interval_hours', every: 6 } }
    ]
  });
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('research runtime integration', () => {
  it('T-INT1 accumulates cross-mission artifacts and generates deterministic summary on daily brief', () => {
    writeJson(path.join(artifactsRoot, 'defi-liquidity-scan', 'run_1', 'liquidity-snapshot-json.json'), {
      snapshots: [{ protocol: 'Aave', tvl: '11.2B', delta24h: '+1.3%' }]
    });
    writeJson(path.join(artifactsRoot, 'defi-yield-report', 'run_2', 'yield-report-json.json'), {
      entries: [{ protocol: 'Aave', yield: '5.2%', change24h: '+0.2%' }]
    });
    writeJson(path.join(artifactsRoot, 'defi-governance-events', 'run_3', 'governance-events-json.json'), {
      events: [{ protocol: 'Uniswap', proposal: 'Proposal 77', status: 'queued', riskSignal: 'Watch fee-switch governance split' }]
    });
    writeJson(path.join(artifactsRoot, 'defi-daily-market-brief', 'run_4', 'daily-market-brief-json.json'), {
      watchlist: ['Aave', 'Uniswap']
    });

    const runtime = createResearchRuntime({
      artifactsRoot,
      teamsDir,
      packsDir,
      scheduleRegistryPath
    });

    runtime.processLaunches([
      {
        scheduleId: 'defi-liquidity-hourly-scan',
        missionId: 'defi-liquidity-scan',
        slotId: 'interval_hours:6:2026-03-10T06:00Z',
        dueDecision: 'due',
        launched: true,
        runId: 'run_1',
        attemptedAtUtc: '2026-03-10T06:01:00.000Z'
      },
      {
        scheduleId: 'defi-yield-hourly-scan',
        missionId: 'defi-yield-report',
        slotId: 'interval_hours:6:2026-03-10T06:00Z',
        dueDecision: 'due',
        launched: true,
        runId: 'run_2',
        attemptedAtUtc: '2026-03-10T06:01:00.000Z'
      },
      {
        scheduleId: 'defi-governance-hourly-scan',
        missionId: 'defi-governance-events',
        slotId: 'interval_hours:6:2026-03-10T06:00Z',
        dueDecision: 'due',
        launched: true,
        runId: 'run_3',
        attemptedAtUtc: '2026-03-10T06:01:00.000Z'
      },
      {
        scheduleId: 'defi-daily-market-brief',
        missionId: 'defi-daily-market-brief',
        slotId: 'daily:2026-03-10',
        dueDecision: 'due',
        launched: true,
        runId: 'run_4',
        attemptedAtUtc: '2026-03-10T13:01:00.000Z'
      }
    ]);

    const latestSummaryPath = path.join(artifactsRoot, 'defi-intelligence', 'daily-briefs', 'latest-summary.json');
    expect(fs.existsSync(latestSummaryPath)).toBe(true);

    const latest = JSON.parse(fs.readFileSync(latestSummaryPath, 'utf8')) as Record<string, string>;
    expect(latest.reportDate).toBe('2026-03-10');
    expect(fs.existsSync(latest.jsonPath)).toBe(true);
    expect(fs.existsSync(latest.markdownPath)).toBe(true);
  });

  it('T-INT2 keeps accumulation idempotent on repeated launch processing', () => {
    writeJson(path.join(artifactsRoot, 'defi-yield-report', 'run_2', 'yield-report-json.json'), {
      entries: [{ protocol: 'Aave', yield: '5.2%', change24h: '+0.2%' }]
    });

    const runtime = createResearchRuntime({
      artifactsRoot,
      teamsDir,
      packsDir,
      scheduleRegistryPath
    });

    const launch = {
      scheduleId: 'defi-yield-hourly-scan',
      missionId: 'defi-yield-report',
      slotId: 'interval_hours:6:2026-03-10T06:00Z',
      dueDecision: 'due' as const,
      launched: true,
      runId: 'run_2',
      attemptedAtUtc: '2026-03-10T06:01:00.000Z'
    };

    const first = runtime.processLaunch(launch);
    const second = runtime.processLaunch(launch);

    expect(first[0].processed).toBe(true);
    expect(second[0].processed).toBe(false);
  });
});
