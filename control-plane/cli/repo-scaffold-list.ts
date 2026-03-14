import { canonicalStringify } from '../finance/determinism.ts';
import { createRepoScaffoldInspection } from '../repo-scaffold/repo-scaffold-inspection.ts';

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    if (argv.length > 0) {
      throw new Error(`UNKNOWN_ARGUMENT: ${argv[0]}`);
    }

    const inspection = createRepoScaffoldInspection();
    const list = inspection.listRepoScaffoldBundles()
      .map((entry) => ({
        bundleId: entry.bundleId,
        packetId: entry.packetId,
        status: entry.status,
      }))
      .sort((left, right) => left.bundleId.localeCompare(right.bundleId));

    printJson(list);
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
