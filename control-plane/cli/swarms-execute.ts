import { runRuntimeOrchestratorFromRepo, stableStringify } from '../swarms/runtime-orchestrator.ts';

type CliArgs = {
  registryPath?: string;
  projectsDir?: string;
  swarmsDir?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--registry-path') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --registry-path.');
      }
      args.registryPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--registry-path=')) {
      const value = arg.slice('--registry-path='.length);
      if (!value) {
        throw new Error('Missing value for --registry-path.');
      }
      args.registryPath = value;
      continue;
    }

    if (arg === '--projects-dir') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --projects-dir.');
      }
      args.projectsDir = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--projects-dir=')) {
      const value = arg.slice('--projects-dir='.length);
      if (!value) {
        throw new Error('Missing value for --projects-dir.');
      }
      args.projectsDir = value;
      continue;
    }

    if (arg === '--swarms-dir') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --swarms-dir.');
      }
      args.swarmsDir = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--swarms-dir=')) {
      const value = arg.slice('--swarms-dir='.length);
      if (!value) {
        throw new Error('Missing value for --swarms-dir.');
      }
      args.swarmsDir = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printJson(value: unknown): void {
  process.stdout.write(`${stableStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const report = runRuntimeOrchestratorFromRepo({
      registryPath: args.registryPath,
      projectsDir: args.projectsDir,
      swarmsDir: args.swarmsDir
    });

    printJson(report);

    if (report.validationStatus === 'failed') {
      return 1;
    }

    return 0;
  } catch {
    printJson({ error: 'unexpected_runtime_error' });
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${stableStringify({ error: 'unexpected_runtime_error' })}\n`);
    process.exit(2);
  });
}
