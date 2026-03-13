import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionReviewManager } from '../mission-control/mission-review-manager.ts';

type ParsedArgs = {
  missionRunId: string;
  requestedBy: string;
  reasonTokens: string[];
  linkedEscalationIds: string[];
  linkedInterventionIds: string[];
};

function parseCommaValues(raw: string): string[] {
  return Array.from(new Set(raw.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv: string[]): ParsedArgs {
  let missionRunId: string | null = null;
  let requestedBy = 'operator';
  let reasonTokens: string[] = [];
  let linkedEscalationIds: string[] = [];
  let linkedInterventionIds: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--run') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --run');
      }
      missionRunId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--run=')) {
      const value = arg.slice('--run='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --run');
      }
      missionRunId = value;
      continue;
    }

    if (arg === '--by') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --by');
      }
      requestedBy = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--by=')) {
      const value = arg.slice('--by='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --by');
      }
      requestedBy = value;
      continue;
    }

    if (arg === '--reason') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --reason');
      }
      reasonTokens = parseCommaValues(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--reason=')) {
      const value = arg.slice('--reason='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --reason');
      }
      reasonTokens = parseCommaValues(value);
      continue;
    }

    if (arg === '--escalations') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --escalations');
      }
      linkedEscalationIds = parseCommaValues(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--escalations=')) {
      const value = arg.slice('--escalations='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --escalations');
      }
      linkedEscalationIds = parseCommaValues(value);
      continue;
    }

    if (arg === '--interventions') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --interventions');
      }
      linkedInterventionIds = parseCommaValues(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--interventions=')) {
      const value = arg.slice('--interventions='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --interventions');
      }
      linkedInterventionIds = parseCommaValues(value);
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!missionRunId) {
    throw new Error('MISSING_ARGUMENT: --run');
  }

  return {
    missionRunId,
    requestedBy,
    reasonTokens,
    linkedEscalationIds,
    linkedInterventionIds,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const result = createMissionReviewManager().deferMissionReview(args);
    printJson(result.statusPreview);
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
    process.stdout.write(`${canonicalStringify({ error: 'MISSION_CONTROL_DEFER_REVIEW_UNEXPECTED_RUNTIME_ERROR' })}\n`);
    process.exit(2);
  });
}
