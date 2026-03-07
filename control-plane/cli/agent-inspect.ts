import { loadAgentProfilesFromDir } from '../agents/agent-profile-loader.ts';
import { buildAgentExecutionEnvelope } from '../agents/runtime/agent-envelope.ts';
import { canonicalStringify } from '../finance/determinism.ts';
import { loadTeamDefinitionsFromDir } from '../teams/team-loader.ts';

type ParsedArgs = {
  agentId: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  let agentId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--agent') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --agent');
      }
      agentId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--agent=')) {
      agentId = arg.slice('--agent='.length);
      if (!agentId) {
        throw new Error('MISSING_ARGUMENT: --agent');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!agentId) {
    throw new Error('MISSING_ARGUMENT: --agent');
  }

  return { agentId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const profiles = loadAgentProfilesFromDir();
    const profile = profiles.find((entry) => entry.agentId === args.agentId);
    if (!profile) {
      throw new Error(`ERR_AGENT_NOT_FOUND: Agent profile not found: ${args.agentId}`);
    }

    const teams = loadTeamDefinitionsFromDir(undefined, profiles)
      .filter((team) => team.members.includes(profile.agentId))
      .sort((left, right) => left.teamId.localeCompare(right.teamId));

    const envelope = buildAgentExecutionEnvelope(profile);

    printJson({
      agentId: profile.agentId,
      profile,
      executionEnvelope: envelope,
      permissions: {
        allowedAdapters: envelope.allowedTools,
        forbiddenAdapters: profile.toolProfile.forbiddenTools
      },
      teams: teams.map((team) => ({
        teamId: team.teamId,
        projectId: team.projectId,
        executionMode: team.executionMode
      }))
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
