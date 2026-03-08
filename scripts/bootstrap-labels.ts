import { ensureLabels, parseCliArgs } from '../control-plane/bootstrap-labels.ts';

function formatList(values: string[]): string {
  return values.length === 0 ? 'none' : values.join(', ');
}

async function main(): Promise<void> {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const summary = await ensureLabels({
      repo: args.repo,
      dryRun: args.dryRun,
      yes: args.yes || process.env.CI === 'true'
    });

    const prefix = args.dryRun ? 'dry-run: ' : '';
    process.stdout.write(`${prefix}created: ${formatList(summary.created)}\n`);
    process.stdout.write(`${prefix}updated: ${formatList(summary.updated)}\n`);
    process.stdout.write(`${prefix}unchanged: ${formatList(summary.unchanged)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = message.includes('Missing GITHUB_TOKEN or GH_TOKEN') ? 2 : 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
