import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSchedulerService } from './service.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-scheduler-service');

function writeRegistry(value: unknown): string {
  fs.mkdirSync(tmpRoot, { recursive: true });
  const filePath = path.join(tmpRoot, 'registry.json');
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('scheduler service', () => {
  it('T-D1 launches once per slot and prevents duplicate relaunches', async () => {
    const registryPath = writeRegistry({
      schemaVersion: 1,
      schedules: [{
        scheduleId: 'daily-brief',
        missionId: 'rwa-market-analysis',
        enabled: true,
        cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 },
        params: { market: 'us' }
      }]
    });

    const missionLauncher = vi.fn(async () => ({ workflowRun: 'run_smartfunds-core_0001' }));
    let nowValue = new Date('2026-03-10T13:01:00.000Z');

    const scheduler = createSchedulerService({
      registryPath,
      rootDir: path.join(tmpRoot, 'journal'),
      missionLauncher,
      now: () => nowValue
    });

    const first = await scheduler.tick();
    expect(first.launches).toHaveLength(1);
    expect(missionLauncher).toHaveBeenCalledTimes(1);

    const second = await scheduler.tick();
    expect(second.launches).toHaveLength(0);
    expect(second.evaluations[0].dueDecision).toBe('already_launched_for_slot');
    expect(missionLauncher).toHaveBeenCalledTimes(1);

    nowValue = new Date('2026-03-11T13:01:00.000Z');
    const third = await scheduler.tick();

    expect(third.launches).toHaveLength(1);
    expect(missionLauncher).toHaveBeenCalledTimes(2);
  });

  it('T-D2 does not launch when nothing is due', async () => {
    const registryPath = writeRegistry({
      schemaVersion: 1,
      schedules: [{
        scheduleId: 'daily-brief',
        missionId: 'rwa-market-analysis',
        enabled: true,
        cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 }
      }]
    });

    const missionLauncher = vi.fn(async () => ({ workflowRun: 'run_smartfunds-core_0001' }));

    const scheduler = createSchedulerService({
      registryPath,
      rootDir: path.join(tmpRoot, 'journal'),
      missionLauncher,
      now: () => new Date('2026-03-10T12:30:00.000Z')
    });

    const result = await scheduler.tick();
    expect(result.launches).toEqual([]);
    expect(result.evaluations[0].dueDecision).toBe('not_due');
    expect(missionLauncher).not.toHaveBeenCalled();
  });

  it('T-D3 failed launch consumes slot and blocks duplicate relaunch', async () => {
    const registryPath = writeRegistry({
      schemaVersion: 1,
      schedules: [{
        scheduleId: 'daily-brief',
        missionId: 'rwa-market-analysis',
        enabled: true,
        cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 }
      }]
    });

    const missionLauncher = vi.fn(async () => {
      throw new Error('MISSION_RUN_FAILED: runtime error');
    });

    const scheduler = createSchedulerService({
      registryPath,
      rootDir: path.join(tmpRoot, 'journal'),
      missionLauncher,
      now: () => new Date('2026-03-10T13:10:00.000Z')
    });

    const first = await scheduler.tick();
    expect(first.launches).toHaveLength(1);
    expect(first.launches[0].launched).toBe(false);
    expect(first.launches[0].launchError).toContain('MISSION_RUN_FAILED');

    const second = await scheduler.tick();
    expect(second.evaluations[0].dueDecision).toBe('already_launched_for_slot');
    expect(missionLauncher).toHaveBeenCalledTimes(1);
  });

  it('T-D4 invokes optional launch hook without changing scheduler outcomes', async () => {
    const registryPath = writeRegistry({
      schemaVersion: 1,
      schedules: [{
        scheduleId: 'daily-brief',
        missionId: 'rwa-market-analysis',
        enabled: true,
        cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 }
      }]
    });

    const missionLauncher = vi.fn(async () => ({ workflowRun: 'run_smartfunds-core_0001' }));
    const onLaunchRecord = vi.fn(async () => {});

    const scheduler = createSchedulerService({
      registryPath,
      rootDir: path.join(tmpRoot, 'journal'),
      missionLauncher,
      onLaunchRecord,
      now: () => new Date('2026-03-10T13:10:00.000Z')
    });

    const result = await scheduler.tick();
    expect(result.launches).toHaveLength(1);
    expect(result.launches[0].runId).toBe('run_smartfunds-core_0001');
    expect(onLaunchRecord).toHaveBeenCalledTimes(1);
    expect(onLaunchRecord).toHaveBeenCalledWith(expect.objectContaining({
      scheduleId: 'daily-brief',
      slotId: 'daily:2026-03-10'
    }));
  });
});
