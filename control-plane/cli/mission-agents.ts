import { buildAgentExecutionEnvelope } from '../agents/runtime/agent-envelope.ts';
import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionRunner } from '../missions/mission-runner.ts';

type ParsedArgs = {
  missionId: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  let missionId: string | null = null;

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

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionId) {
    throw new Error('MISSING_ARGUMENT: --mission');
  }

  return { missionId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const runner = createMissionRunner();
    const inspected = runner.inspectMission(args.missionId);

    const roster = [...inspected.agentRoster]
      .sort((left, right) => left.agentId.localeCompare(right.agentId))
      .map((profile) => {
        const envelope = buildAgentExecutionEnvelope(profile);

        return {
          agentId: profile.agentId,
          role: profile.role,
          allowedTools: envelope.allowedTools,
          adapterType: profile.adapterType
        };
      });

    printJson({
      mission: {
        missionId: inspected.mission.missionId,
        projectId: inspected.mission.projectId,
        teamId: inspected.team.teamId,
        workflowId: inspected.workflowId
      },
      roster
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
