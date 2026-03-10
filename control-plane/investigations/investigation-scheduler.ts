import type { ScheduleEvaluation } from '../scheduler/types.ts';

import { createInvestigationExecutor, type InvestigationExecutor } from './investigation-executor.ts';
import { deriveLogDateFromSlot } from './investigation-lifecycle.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createInvestigationScheduler(options: {
  executor?: InvestigationExecutor;
  definitionsDir?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  signalsRootDir?: string;
} = {}) {
  const executor = options.executor ?? createInvestigationExecutor({
    definitionsDir: options.definitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    signalsRootDir: options.signalsRootDir
  });

  function collectSchedulerSlots(evaluations: ScheduleEvaluation[]): string[] {
    return uniqueSorted(
      evaluations
        .map((evaluation) => evaluation.currentSlotId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    );
  }

  function advanceForSchedulerTick(input: { tickTimeUtc: string; evaluations: ScheduleEvaluation[] }) {
    const schedulerSlots = collectSchedulerSlots(input.evaluations);
    const fallbackDate = input.tickTimeUtc.slice(0, 10);

    const progress = schedulerSlots.map((schedulerSlot) => executor.advanceDueInvestigations({
      schedulerSlot,
      logDate: deriveLogDateFromSlot(schedulerSlot, fallbackDate)
    }));

    const active = executor.listInvestigations().filter((record) => !['completed', 'failed', 'cancelled'].includes(record.status));

    return {
      tickTimeUtc: input.tickTimeUtc,
      schedulerSlots,
      advancedInvestigations: uniqueSorted(progress.flatMap((entry) => entry.advancedInvestigations)),
      dueBySlot: progress,
      activeCount: active.length
    };
  }

  return {
    advanceForSchedulerTick,
    listDueInvestigations: executor.listDueInvestigations
  };
}

export type InvestigationScheduler = ReturnType<typeof createInvestigationScheduler>;
