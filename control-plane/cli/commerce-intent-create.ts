import { canonicalStringify } from '../finance/determinism.ts';
import { createCommerceInspection } from '../commerce/commerce-inspection.ts';
import type { RailClass } from '../commerce/charge-intent-types.ts';

function parseRails(value: string): RailClass[] {
  return value.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((left, right) => left.localeCompare(right)) as RailClass[];
}

function parseArgs(argv: string[]): {
  buildEvidenceBundleId: string;
  monetizationClass?: string;
  amount?: string;
  currency?: string;
  payTo?: string;
  railClasses?: RailClass[];
} {
  const result: {
    buildEvidenceBundleId: string | null;
    monetizationClass?: string;
    amount?: string;
    currency?: string;
    payTo?: string;
    railClasses?: RailClass[];
  } = {
    buildEvidenceBundleId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;

    if (token === '--evidence') {
      result.buildEvidenceBundleId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token.startsWith('--evidence=')) {
      result.buildEvidenceBundleId = token.slice('--evidence='.length);
      continue;
    }

    if (token === '--class') {
      result.monetizationClass = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--class=')) {
      result.monetizationClass = token.slice('--class='.length);
      continue;
    }

    if (token === '--amount') {
      result.amount = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--amount=')) {
      result.amount = token.slice('--amount='.length);
      continue;
    }

    if (token === '--currency') {
      result.currency = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--currency=')) {
      result.currency = token.slice('--currency='.length);
      continue;
    }

    if (token === '--pay-to') {
      result.payTo = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--pay-to=')) {
      result.payTo = token.slice('--pay-to='.length);
      continue;
    }

    if (token === '--rails') {
      result.railClasses = parseRails(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (token.startsWith('--rails=')) {
      result.railClasses = parseRails(token.slice('--rails='.length));
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${token}`);
  }

  if (!result.buildEvidenceBundleId) {
    throw new Error('MISSING_ARGUMENT: --evidence');
  }

  return {
    buildEvidenceBundleId: result.buildEvidenceBundleId,
    monetizationClass: result.monetizationClass,
    amount: result.amount,
    currency: result.currency,
    payTo: result.payTo,
    railClasses: result.railClasses,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createCommerceInspection();
    printJson(inspection.createIntent({
      buildEvidenceBundleId: args.buildEvidenceBundleId,
      ...(args.monetizationClass ? { monetizationClass: args.monetizationClass as never } : {}),
      ...(args.amount ? { amount: args.amount } : {}),
      ...(args.currency ? { currency: args.currency } : {}),
      ...(args.payTo ? { payTo: args.payTo } : {}),
      ...(args.railClasses ? { railClasses: args.railClasses } : {}),
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
