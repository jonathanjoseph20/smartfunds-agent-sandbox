import { canonicalStringify } from '../finance/determinism.ts';
import { createInvestigationScheduler } from '../investigations/investigation-scheduler.ts';
import { createCohortInspection } from '../cohorts/cohort-inspection.ts';
import { createResearchRuntime } from '../research/runtime.ts';
import { createSchedulerService } from '../scheduler/service.ts';

function parseArgs(argv: string[]): { dryRun: boolean } {
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  return { dryRun };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const runtime = createResearchRuntime();
    const investigationScheduler = createInvestigationScheduler();
    const processingOutcomes: ReturnType<typeof runtime.processLaunch>[] = [];

    const scheduler = createSchedulerService({
      onLaunchRecord(launch) {
        processingOutcomes.push(runtime.processLaunch(launch));
      }
    });

    const result = await scheduler.tick({ dryRun: args.dryRun });
    const slots = uniqueSorted(
      result.evaluations
        .map((evaluation) => evaluation.currentSlotId)
        .filter((slot): slot is string => typeof slot === 'string' && slot.length > 0)
    );
    let investigations: Record<string, unknown> = {
      tickTimeUtc: result.tickTimeUtc,
      schedulerSlots: [],
      advancedInvestigations: [],
      dueBySlot: [],
      activeCount: 0
    };
    try {
      investigations = investigationScheduler.advanceForSchedulerTick({
        tickTimeUtc: result.tickTimeUtc,
        evaluations: result.evaluations
      }) as unknown as Record<string, unknown>;
    } catch {
      // Investigation scheduler integration is passive and must not alter scheduler semantics.
    }
    const cohortInspection = createCohortInspection();
    const cohortEscalation = cohortInspection.listCohorts()
      .flatMap((cohort) => slots.map((slot) => (
        args.dryRun
          ? {
            projection: cohortInspection.inspectCohortEscalation({
              cohortId: cohort.cohortId,
              slotOrReference: slot
            }),
            historyEntry: null,
            historyAppended: false,
            statusPath: null
          }
          : cohortInspection.evaluateCohortEscalation({
            cohortId: cohort.cohortId,
            slotOrReference: slot
          })
      )))
      .sort((left, right) => {
        const cohortCmp = left.projection.cohortId.localeCompare(right.projection.cohortId);
        if (cohortCmp !== 0) {
          return cohortCmp;
        }
        return left.projection.slotOrReference.localeCompare(right.projection.slotOrReference);
      });
    const cohortAutomation = slots
      .flatMap((slot) => (
        args.dryRun
          ? cohortInspection.listCohorts()
            .flatMap((cohort) => cohortInspection.inspectCohortAutomationStatus({ cohortId: cohort.cohortId, slot }))
            .map((status) => ({ status, historyAppended: false }))
          : cohortInspection.evaluateCohortPrograms({ slot })
      ))
      .sort((left, right) => {
        const cohortCmp = left.status.cohortId.localeCompare(right.status.cohortId);
        if (cohortCmp !== 0) {
          return cohortCmp;
        }
        const programCmp = left.status.programId.localeCompare(right.status.programId);
        if (programCmp !== 0) {
          return programCmp;
        }
        return left.status.evaluationState.localeCompare(right.status.evaluationState);
      });
    printJson({
      ...result,
      investigations,
      cohortEscalation,
      cohortAutomation,
      research: processingOutcomes.flat().sort((left, right) => {
        const teamCmp = left.teamId.localeCompare(right.teamId);
        if (teamCmp !== 0) {
          return teamCmp;
        }
        const packCmp = left.packId.localeCompare(right.packId);
        if (packCmp !== 0) {
          return packCmp;
        }
        return left.scheduleId.localeCompare(right.scheduleId);
      })
    });
    return 0;
  } catch (error) {
    printJson({ error: (error as Error).message });
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${canonicalStringify({ error: 'unexpected_runtime_error' })}\n`);
    process.exit(2);
  });
}
