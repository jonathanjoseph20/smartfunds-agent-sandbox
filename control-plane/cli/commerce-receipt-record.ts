import { canonicalStringify } from '../finance/determinism.ts';
import { createCommerceInspection } from '../commerce/commerce-inspection.ts';

function parseReasonTokens(value: string): string[] {
  return value.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv: string[]): {
  chargeIntentId: string;
  railBindingId: string;
  receiptClass: string;
  receiptReference: string;
  reasonTokens: string[];
} {
  const parsed: {
    chargeIntentId: string | null;
    railBindingId: string | null;
    receiptClass: string | null;
    receiptReference: string | null;
    reasonTokens: string[];
  } = {
    chargeIntentId: null,
    railBindingId: null,
    receiptClass: null,
    receiptReference: null,
    reasonTokens: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;

    if (token === '--intent') {
      parsed.chargeIntentId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--intent=')) {
      parsed.chargeIntentId = token.slice('--intent='.length);
      continue;
    }

    if (token === '--rail-binding') {
      parsed.railBindingId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--rail-binding=')) {
      parsed.railBindingId = token.slice('--rail-binding='.length);
      continue;
    }

    if (token === '--class') {
      parsed.receiptClass = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--class=')) {
      parsed.receiptClass = token.slice('--class='.length);
      continue;
    }

    if (token === '--reference') {
      parsed.receiptReference = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--reference=')) {
      parsed.receiptReference = token.slice('--reference='.length);
      continue;
    }

    if (token === '--reasons') {
      parsed.reasonTokens = parseReasonTokens(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (token.startsWith('--reasons=')) {
      parsed.reasonTokens = parseReasonTokens(token.slice('--reasons='.length));
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${token}`);
  }

  if (!parsed.chargeIntentId) {
    throw new Error('MISSING_ARGUMENT: --intent');
  }

  if (!parsed.railBindingId) {
    throw new Error('MISSING_ARGUMENT: --rail-binding');
  }

  if (!parsed.receiptClass) {
    throw new Error('MISSING_ARGUMENT: --class');
  }

  if (!parsed.receiptReference) {
    throw new Error('MISSING_ARGUMENT: --reference');
  }

  return {
    chargeIntentId: parsed.chargeIntentId,
    railBindingId: parsed.railBindingId,
    receiptClass: parsed.receiptClass,
    receiptReference: parsed.receiptReference,
    reasonTokens: parsed.reasonTokens,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createCommerceInspection();
    printJson(inspection.recordReceipt({
      chargeIntentId: args.chargeIntentId,
      railBindingId: args.railBindingId,
      receiptClass: args.receiptClass as never,
      receiptReference: args.receiptReference,
      reasonTokens: args.reasonTokens,
    }));
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
