import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExecutionJournal } from '../journal/journal.ts';
import { createSwarmRunner } from './swarm-runner.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-swarm-engine-runtime');

function resetTmpRoot(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

beforeEach(() => {
  resetTmpRoot();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('swarm-runner', () => {
  it('creates run for valid project and emits RUN_CREATED', () => {
    const runner = createSwarmRunner({ rootDir: tmpRoot });
    const summary = runner.createSwarmRun({ projectId: 'control-plane' });
    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const inspected = journal.inspectRun(summary.runId);

    expect(summary.status).toBe('created');
    expect(inspected.events).toHaveLength(1);
    expect(inspected.events[0].type).toBe('RUN_CREATED');
  });

  it('fails run creation for unknown project', () => {
    const runner = createSwarmRunner({ rootDir: tmpRoot });

    expect(() => runner.createSwarmRun({ projectId: 'unknown-project' })).toThrow(/Unknown project: unknown-project/);
  });

  it('derives entity, pod, and mode from canonical registry metadata', () => {
    const runner = createSwarmRunner({ rootDir: tmpRoot });
    const summary = runner.createSwarmRun({ projectId: 'control-plane' });

    expect(summary.projectId).toBe('control-plane');
    expect(summary.entity).toBe('core-entity');
    expect(summary.pod).toBe('smartfunds');
    expect(summary.mode).toBe('structured');
  });

  it('executes full phase lifecycle and emits ordered completion events', async () => {
    const runner = createSwarmRunner({ rootDir: tmpRoot });
    const created = runner.createSwarmRun({ projectId: 'control-plane' });

    const finalSummary = await runner.executeSwarmRun({ runId: created.runId });
    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const inspected = journal.inspectRun(created.runId);

    expect(finalSummary.status).toBe('completed');
    expect(finalSummary.completedPhases).toEqual(['plan', 'setup', 'implement', 'verify', 'test', 'release']);

    expect(inspected.events.map((event) => event.type)).toEqual([
      'RUN_CREATED',
      'PHASE_STARTED', 'TASK_STARTED', 'TASK_COMPLETED', 'PHASE_COMPLETED',
      'PHASE_STARTED', 'TASK_STARTED', 'TASK_COMPLETED', 'PHASE_COMPLETED',
      'PHASE_STARTED', 'TASK_STARTED', 'TASK_COMPLETED', 'PHASE_COMPLETED',
      'PHASE_STARTED', 'TASK_STARTED', 'TASK_COMPLETED', 'PHASE_COMPLETED',
      'PHASE_STARTED', 'TASK_STARTED', 'TASK_COMPLETED', 'PHASE_COMPLETED',
      'PHASE_STARTED', 'TASK_STARTED', 'TASK_COMPLETED', 'PHASE_COMPLETED',
      'RUN_COMPLETED'
    ]);

    expect(inspected.events.filter((event) => event.type === 'PHASE_STARTED').map((event) => event.phase)).toEqual([
      'plan',
      'setup',
      'implement',
      'verify',
      'test',
      'release'
    ]);

    expect(inspected.events.filter((event) => event.type === 'PHASE_COMPLETED').map((event) => event.phase)).toEqual([
      'plan',
      'setup',
      'implement',
      'verify',
      'test',
      'release'
    ]);
  });

  it('emits TASK_FAILED and RUN_FAILED and stops later phases on task failure', async () => {
    const runner = createSwarmRunner({
      rootDir: tmpRoot,
      taskExecutors: {
        'execute-work-unit': () => {
          throw new Error('FORCED_FAILURE');
        }
      }
    });

    const created = runner.createSwarmRun({ projectId: 'control-plane' });
    const finalSummary = await runner.executeSwarmRun({ runId: created.runId });

    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const inspected = journal.inspectRun(created.runId);

    expect(finalSummary.status).toBe('failed');
    expect(finalSummary.failedPhase).toBe('implement');

    const eventTypes = inspected.events.map((event) => event.type);
    expect(eventTypes.includes('TASK_FAILED')).toBe(true);
    expect(eventTypes[eventTypes.length - 1]).toBe('RUN_FAILED');

    const startedPhases = inspected.events
      .filter((event) => event.type === 'PHASE_STARTED')
      .map((event) => event.phase);

    expect(startedPhases).toEqual(['plan', 'setup', 'implement']);
    expect(startedPhases.includes('verify')).toBe(false);
    expect(startedPhases.includes('test')).toBe(false);
    expect(startedPhases.includes('release')).toBe(false);
  });

  it('derives status from journal replay deterministically', async () => {
    const runner = createSwarmRunner({ rootDir: tmpRoot });
    const created = runner.createSwarmRun({ projectId: 'control-plane' });

    await runner.executeSwarmRun({ runId: created.runId });

    const first = runner.getSwarmRunStatus({ runId: created.runId });
    const second = runner.getSwarmRunStatus({ runId: created.runId });

    expect(first).toEqual(second);
  });

  it('produces stable ordering and summary shape across repeated deterministic runs', async () => {
    const runner = createSwarmRunner({ rootDir: tmpRoot });
    const journal = createExecutionJournal({ rootDir: tmpRoot });

    const firstCreated = runner.createSwarmRun({ projectId: 'control-plane' });
    const secondCreated = runner.createSwarmRun({ projectId: 'control-plane' });

    const firstFinal = await runner.executeSwarmRun({ runId: firstCreated.runId });
    const secondFinal = await runner.executeSwarmRun({ runId: secondCreated.runId });

    const firstEvents = journal.inspectRun(firstCreated.runId).events;
    const secondEvents = journal.inspectRun(secondCreated.runId).events;

    const projectEvents = (events: typeof firstEvents) => events.map((event) => ({
      sequence: event.sequence,
      type: event.type,
      phase: event.phase,
      taskId: event.taskId ?? null
    }));

    expect(projectEvents(firstEvents)).toEqual(projectEvents(secondEvents));

    const projectSummary = (summary: typeof firstFinal) => ({
      status: summary.status,
      currentPhase: summary.currentPhase,
      completedPhases: summary.completedPhases,
      failedPhase: summary.failedPhase ?? null,
      phaseSummaries: summary.phaseSummaries,
      taskSummaries: summary.taskSummaries,
      eventCount: summary.eventCount
    });

    expect(projectSummary(firstFinal)).toEqual(projectSummary(secondFinal));
  });
});
