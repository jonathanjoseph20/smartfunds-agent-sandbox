import { loadAgentProfilesFromDir } from '../agents/agent-profile-loader.ts';
import { canonicalStringify } from '../finance/determinism.ts';
import { loadTeamDefinitionById } from '../teams/team-loader.ts';

type ParsedArgs = {
  teamId: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  let teamId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--team') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --team');
      }
      teamId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--team=')) {
      teamId = arg.slice('--team='.length);
      if (!teamId) {
        throw new Error('MISSING_ARGUMENT: --team');
      }
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!teamId) {
    throw new Error('MISSING_ARGUMENT: --team');
  }

  return { teamId };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const profiles = loadAgentProfilesFromDir();
    const team = loadTeamDefinitionById(args.teamId, undefined, profiles);
    const profileById = new Map(profiles.map((profile) => [profile.agentId, profile]));

    const memberSummaries = team.members
      .map((memberId) => profileById.get(memberId))
      .filter((profile) => profile !== undefined)
      .map((profile) => ({
        agentId: profile.agentId,
        displayName: profile.displayName,
        role: profile.role,
        adapterType: profile.adapterType,
        adapterCompatibility: profile.toolProfile.allowedAdapters.includes(profile.adapterType)
      }));

    printJson({
      team: {
        teamId: team.teamId,
        name: team.name,
        projectId: team.projectId,
        executionMode: team.executionMode
      },
      members: team.members,
      agentSummaries: memberSummaries,
      adapterCompatibility: memberSummaries.every((entry) => entry.adapterCompatibility)
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
