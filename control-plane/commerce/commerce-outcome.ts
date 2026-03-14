import type { CommerceOutcome, CommerceStatus } from './charge-intent-types.ts';

export function deriveCommerceOutcome(input: {
  amount: string;
  status: CommerceStatus;
}): CommerceOutcome {
  if (input.amount === '0.00') {
    return 'no_charge';
  }

  if (input.status === 'fulfilled') {
    return 'settled';
  }

  if (input.status === 'blocked') {
    return 'blocked';
  }

  if (input.status === 'failed') {
    return 'failed';
  }

  if (input.status === 'inconclusive') {
    return 'inconclusive';
  }

  return 'pending_settlement';
}
