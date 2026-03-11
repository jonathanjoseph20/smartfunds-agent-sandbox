import { canonicalStringify } from '../finance/determinism.ts';
import { createResearchTeamInspection } from '../research-teams/research-team-inspection.ts';

function parseArgs(argv: string[]): { teamId: string; slotReference?: string } {
  let teamId: string | null = null;
  let slotReference: string | null = null;

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
      const value = arg.slice('--team='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --team');
      }
      teamId = value;
      continue;
    }

    if (arg === '--slot') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --slot');
      }
      slotReference = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--slot=')) {
      const value = arg.slice('--slot='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --slot');
      }
      slotReference = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!teamId) {
    throw new Error('MISSING_ARGUMENT: --team');
  }

  return {
    teamId,
    ...(slotReference ? { slotReference } : {})
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createResearchTeamInspection();
    const result = inspection.materializeTeam(args);
    printJson(result);
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
