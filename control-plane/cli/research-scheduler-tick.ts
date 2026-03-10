import { canonicalStringify } from '../finance/determinism.ts';
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

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const runtime = createResearchRuntime();
    const processingOutcomes: ReturnType<typeof runtime.processLaunch>[] = [];

    const scheduler = createSchedulerService({
      onLaunchRecord(launch) {
        processingOutcomes.push(runtime.processLaunch(launch));
      }
    });

    const result = await scheduler.tick({ dryRun: args.dryRun });
    printJson({
      ...result,
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
