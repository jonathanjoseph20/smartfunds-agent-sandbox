import { canonicalStringify } from '../finance/determinism.ts';
import { validateProfileRequest } from '../policy/profile-validation.ts';

type ParsedArgs = {
  profile: string;
  capabilities: string[];
  mutationIntent: string;
  repo?: string;
  paths: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv: string[]): ParsedArgs {
  let profile: string | null = null;
  const capabilities: string[] = [];
  let mutationIntent = 'none';
  let repo: string | undefined;
  const paths: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--profile') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --profile');
      }
      profile = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      profile = arg.slice('--profile='.length);
      if (!profile) {
        throw new Error('MISSING_ARGUMENT: --profile');
      }
      continue;
    }

    if (arg === '--capability') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --capability');
      }
      capabilities.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--capability=')) {
      const value = arg.slice('--capability='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --capability');
      }
      capabilities.push(value);
      continue;
    }

    if (arg === '--intent') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --intent');
      }
      mutationIntent = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--intent=')) {
      const value = arg.slice('--intent='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --intent');
      }
      mutationIntent = value;
      continue;
    }

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

    if (arg === '--path') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --path');
      }
      paths.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--path=')) {
      const value = arg.slice('--path='.length);
      if (!value) {
        throw new Error('MISSING_ARGUMENT: --path');
      }
      paths.push(value);
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!profile) {
    throw new Error('MISSING_ARGUMENT: --profile');
  }

  if ((repo && paths.length === 0) || (!repo && paths.length > 0)) {
    throw new Error('INVALID_ARGUMENT_COMBINATION: --repo and --path must be provided together.');
  }

  return {
    profile,
    capabilities: sortedUnique(capabilities),
    mutationIntent,
    ...(repo ? { repo } : {}),
    paths: sortedUnique(paths)
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const validation = validateProfileRequest({
      profile: args.profile,
      requestedCapabilities: args.capabilities,
      mutationIntent: args.mutationIntent,
      ...(args.repo
        ? {
          targetScope: {
            repo: args.repo,
            paths: args.paths
          }
        }
        : {})
    });

    printJson({
      profile: args.profile,
      capabilities: args.capabilities,
      mutationIntent: args.mutationIntent,
      ...(args.repo ? { targetScope: { repo: args.repo, paths: args.paths } } : {}),
      validation
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

export { parseArgs };
