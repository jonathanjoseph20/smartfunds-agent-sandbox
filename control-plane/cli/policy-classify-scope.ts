import { canonicalStringify } from '../finance/determinism.ts';
import { classifyScope } from '../policy/core-classification.ts';
import { loadScopeRegistry } from '../policy/scope-registry.ts';

type ParsedArgs = {
  repo: string;
  paths: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv: string[]): ParsedArgs {
  let repo: string | null = null;
  const paths: string[] = [];

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
      const pathValue = arg.slice('--path='.length);
      if (!pathValue) {
        throw new Error('MISSING_ARGUMENT: --path');
      }
      paths.push(pathValue);
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  if (!repo) {
    throw new Error('MISSING_ARGUMENT: --repo');
  }

  return {
    repo,
    paths: sortedUnique(paths)
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const registry = loadScopeRegistry();
    const classification = classifyScope({
      registry,
      targetScope: {
        repo: args.repo,
        ...(args.paths.length > 0 ? { paths: args.paths } : {})
      }
    });

    printJson({
      repo: args.repo,
      paths: args.paths,
      classification
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
