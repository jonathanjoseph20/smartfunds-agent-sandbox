import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionService } from '../operator/mission-service.ts';

type ParsedArgs = {
  missionId: string;
  profile?: string;
  json: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  let missionId: string | null = null;
  let profile: string | undefined;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--mission') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --mission');
      }
      missionId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--mission=')) {
      missionId = arg.slice('--mission='.length);
      if (!missionId) {
        throw new Error('MISSING_ARGUMENT: --mission');
      }
      continue;
    }

    if (arg === '--profile') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --profile');
      }
      profile = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      profile = arg.slice('--profile='.length);
      if (!profile) {
        throw new Error('MISSING_ARGUMENT: --profile');
      }
      continue;
    }

    if (arg === '--json') {
      json = true;
      continue;
    }

    if (!arg.startsWith('-') && missionId === null) {
      missionId = arg;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionId) {
    throw new Error('MISSING_ARGUMENT: --mission');
  }

  return { missionId, ...(profile ? { profile } : {}), json };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

function printReadableResult(result: Record<string, unknown>): void {
  const missionId = String(result.missionId ?? 'unknown-mission');
  const profile = String(result.profile ?? 'core');
  const runId = String(result.workflowRun ?? 'unknown-run');
  const status = String(result.status ?? 'unknown');
  const artifactCount = typeof result.artifactCount === 'number' && Number.isFinite(result.artifactCount)
    ? result.artifactCount
    : 0;

  process.stdout.write(`Mission: ${missionId}\n`);
  process.stdout.write(`Profile: ${profile}\n`);
  process.stdout.write(`Run: ${runId}\n`);
  process.stdout.write(`Status: ${status}\n`);
  process.stdout.write(`Artifacts: ${String(artifactCount)}\n\n`);
  process.stdout.write('Next:\n');
  process.stdout.write('  npm run runs:list\n');
  process.stdout.write(`  npm run artifacts:view -- --run ${runId}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const missionService = createMissionService();
    const result = await missionService.startMission({
      missionId: args.missionId,
      params: {},
      ...(args.profile ? { profile: args.profile } : {})
    });
    if (args.json) {
      printJson(result);
    } else {
      printReadableResult(result);
    }
    return 0;
  } catch (error) {
    const message = (error as Error).message;
    const code = message.includes(':') ? message.slice(0, message.indexOf(':')).trim() : 'MISSION_REJECTED';
    const reason = message.includes(':') ? message.slice(message.indexOf(':') + 1).trim() : message;
    process.stdout.write('Mission rejected\n');
    process.stdout.write(`Code: ${code}\n`);
    process.stdout.write(`Reason: ${reason}\n`);
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
