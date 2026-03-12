import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionAssignmentInspection } from '../mission-assignment/mission-assignment-inspection.ts';

function parseArgs(argv: string[]): { assignmentPolicyId?: string } {
  if (argv.length === 0) {
    return {};
  }

  if (argv.length === 2 && argv[0] === '--policy') {
    if (!argv[1]) {
      throw new Error('MISSING_ARGUMENT: --policy');
    }
    return { assignmentPolicyId: argv[1] };
  }

  if (argv.length === 1 && argv[0].startsWith('--policy=')) {
    const assignmentPolicyId = argv[0].slice('--policy='.length);
    if (!assignmentPolicyId) {
      throw new Error('MISSING_ARGUMENT: --policy');
    }
    return { assignmentPolicyId };
  }

  throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createMissionAssignmentInspection();
    printJson(inspection.listAssignments(args));
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
