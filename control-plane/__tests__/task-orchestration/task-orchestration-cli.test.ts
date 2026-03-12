import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as orchestrationStatusMain } from '../../cli/task-execution-orchestration-status.ts';
import { main as assignmentsMain } from '../../cli/task-execution-assignments.ts';
import { main as queuesMain } from '../../cli/task-execution-queues.ts';
import { main as deferralsMain } from '../../cli/task-execution-deferrals.ts';
import { main as orchestrationHistoryMain } from '../../cli/task-execution-orchestration-history.ts';
import { main as cycleMain } from '../../cli/task-execution-cycle.ts';
import { main as orchestrateMain } from '../../cli/task-execution-orchestrate.ts';
import { main as assignMain } from '../../cli/task-execution-assign.ts';

const {
  taskExecutionOrchestrationStatus,
  taskExecutionAssignments,
  taskExecutionQueues,
  taskExecutionDeferrals,
  taskExecutionOrchestrationHistory,
  taskExecutionCycle,
  taskExecutionOrchestrate,
  taskExecutionAssign,
} = vi.hoisted(() => ({
  taskExecutionOrchestrationStatus: vi.fn(() => ({ taskGraphId: 'tg-1', cycleState: 'completed' })),
  taskExecutionAssignments: vi.fn(() => ([])),
  taskExecutionQueues: vi.fn(() => ([])),
  taskExecutionDeferrals: vi.fn(() => ([])),
  taskExecutionOrchestrationHistory: vi.fn(() => ([])),
  taskExecutionCycle: vi.fn(() => ({ cycle: { cycleIndex: 1 } })),
  taskExecutionOrchestrate: vi.fn(() => ({ cycleCount: 1 })),
  taskExecutionAssign: vi.fn(() => ({ assignments: [] })),
}));

vi.mock('../../task-execution/task-execution-inspection.ts', () => ({
  createTaskExecutionInspection: vi.fn(() => ({
    taskExecutionOrchestrationStatus,
    taskExecutionAssignments,
    taskExecutionQueues,
    taskExecutionDeferrals,
    taskExecutionOrchestrationHistory,
    taskExecutionCycle,
    taskExecutionOrchestrate,
    taskExecutionAssign,
  })),
}));

describe('task orchestration cli', () => {
  it('T-MTO-CLI1 inspection commands route graph and print canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await orchestrationStatusMain(['--graph', 'tg-1'])).toBe(0);
    expect(await assignmentsMain(['--graph=tg-1'])).toBe(0);
    expect(await queuesMain(['--graph', 'tg-1'])).toBe(0);
    expect(await deferralsMain(['--graph=tg-1'])).toBe(0);
    expect(await orchestrationHistoryMain(['--graph', 'tg-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(taskExecutionOrchestrationStatus())}\n`);
    stdout.mockRestore();
  });

  it('T-MTO-CLI2 cycle control commands route optional policy and max-cycles', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await cycleMain(['--graph', 'tg-1', '--policy', 'stable-lexical-default'])).toBe(0);
    expect(await orchestrateMain(['--graph', 'tg-1', '--policy=stable-lexical-default', '--max-cycles=2'])).toBe(0);
    expect(await assignMain(['--graph=tg-1', '--policy=stable-lexical-default'])).toBe(0);

    expect(taskExecutionCycle).toHaveBeenCalledWith({ taskGraphId: 'tg-1', workerSchedulingPolicyId: 'stable-lexical-default' });
    expect(taskExecutionOrchestrate).toHaveBeenCalledWith({ taskGraphId: 'tg-1', workerSchedulingPolicyId: 'stable-lexical-default', maxCycles: 2 });
    expect(taskExecutionAssign).toHaveBeenCalledWith({ taskGraphId: 'tg-1', workerSchedulingPolicyId: 'stable-lexical-default' });
    stdout.mockRestore();
  });
});
