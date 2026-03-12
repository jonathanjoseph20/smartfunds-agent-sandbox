import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionActivationInspection } from '../mission-activation/mission-activation-inspection.ts';

function parseArgs(argv: string[]): { missionId: string; activationPolicyId?: string } {
  let missionId: string | null = null;
  let activationPolicyId: string | undefined;

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
      const value = arg.slice('--mission='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --mission');
      }
      missionId = value;
      continue;
    }

    if (arg === '--policy') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      activationPolicyId = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--policy=')) {
      const value = arg.slice('--policy='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --policy');
      }
      activationPolicyId = value;
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionId) {
    throw new Error('MISSING_ARGUMENT: --mission');
  }

  return {
    missionId,
    ...(activationPolicyId ? { activationPolicyId } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createMissionActivationInspection();
    printJson(inspection.getActivationStatus(args));
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
