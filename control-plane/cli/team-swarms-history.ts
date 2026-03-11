import { canonicalStringify } from '../finance/determinism.ts';
import { createTeamSwarmInspection } from '../team-swarm-coordination/team-swarm-inspection.ts';

function parseArgs(argv: string[]): { teamId: string } {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--team') {
      const teamId = argv[index + 1];
      if (!teamId) {
        throw new Error('MISSING_ARGUMENT: --team');
      }
      if (index !== argv.length - 2) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[index + 2]}`);
      }
      return { teamId };
    }
    if (arg.startsWith('--team=')) {
      const teamId = arg.slice('--team='.length);
      if (!teamId) {
        throw new Error('MISSING_ARGUMENT: --team');
      }
      if (argv.length > 1) {
        throw new Error(`UNKNOWN_ARGUMENT: ${argv[1]}`);
      }
      return { teamId };
    }
    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  throw new Error('MISSING_ARGUMENT: --team');
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createTeamSwarmInspection();
    printJson(inspection.getTeamHistory(args.teamId));
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
