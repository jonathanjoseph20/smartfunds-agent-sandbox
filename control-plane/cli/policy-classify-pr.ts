import { canonicalStringify } from '../finance/determinism.ts';
import { parsePullNumber, resolvePullRequestMetadata } from '../governance/pr-files-api.ts';
import { routePrGovernanceProfile } from '../policy/pr-profile-routing.ts';

type ParsedArgs = {
  repo: string;
  pr: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  let repo: string | null = null;
  let pr: number | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--repo') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --repo');
      }
      repo = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--repo=')) {
      repo = arg.slice('--repo='.length);
      if (!repo) {
        throw new Error('MISSING_ARGUMENT: --repo');
      }
      continue;
    }

    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --pr');
      }
      pr = parsePullNumber(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--pr=')) {
      pr = parsePullNumber(arg.slice('--pr='.length));
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!repo) {
    throw new Error('MISSING_ARGUMENT: --repo');
  }
  if (pr === null) {
    throw new Error('MISSING_ARGUMENT: --pr');
  }

  return { repo, pr };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const metadata = await resolvePullRequestMetadata({
      repository: args.repo,
      pullNumber: args.pr,
      requireApi: true
    });

    const routed = routePrGovernanceProfile({
      prBody: metadata.body,
      changedFiles: metadata.changedFiles,
      repository: args.repo
    });

    printJson({
      profile: routed.profile,
      requestedProfile: routed.requestedProfile,
      requiredProfile: routed.requiredProfile,
      finalProfile: routed.finalProfile,
      matchedScopes: routed.matchedScopes,
      source: routed.source
    });

    return routed.ok ? 0 : 1;
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

export { parseArgs };
