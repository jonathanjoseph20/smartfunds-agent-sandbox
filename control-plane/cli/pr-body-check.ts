import { readBodyFile, validatePrBody } from '../governance/pr-body.ts';

const DEFAULT_BODY_FILE = '.pr-body.md';

type ParsedArgs = {
  bodyFile: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  let bodyFile = DEFAULT_BODY_FILE;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--body-file' || arg === '--file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --body-file.');
      }
      bodyFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--body-file=')) {
      bodyFile = arg.slice('--body-file='.length);
      if (!bodyFile) {
        throw new Error('Missing value for --body-file.');
      }
      continue;
    }
    if (arg.startsWith('--file=')) {
      bodyFile = arg.slice('--file='.length);
      if (!bodyFile) {
        throw new Error('Missing value for --file.');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { bodyFile };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const body = readBodyFile(args.bodyFile);
  const result = validatePrBody(body);
  console.log(`PR body OK. Tier: ${result.tier}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
