import { deriveRailEligibilityId } from './charge-intent-identity.ts';
import { uniqueSorted } from './commerce-normalizer.ts';
import type { ChargeIntent, RailBinding, RailEligibility } from './charge-intent-types.ts';

function evaluateEligibility(input: {
  chargeIntent: ChargeIntent;
  binding: RailBinding;
}): Omit<RailEligibility, 'railEligibilityId' | 'chargeIntentId' | 'railBindingId'> {
  const amount = Number.parseFloat(input.chargeIntent.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      eligibilityStatus: 'inconclusive',
      reasonTokens: ['invalid_amount'],
      blockingConditionTokens: ['amount_not_numeric'],
      state: 'inconclusive',
    };
  }

  if (input.binding.bindingClass === 'blocked_binding') {
    return {
      eligibilityStatus: 'blocked',
      reasonTokens: ['binding_blocked'],
      blockingConditionTokens: ['blocked_binding'],
      state: 'blocked',
    };
  }

  if (input.binding.railClass === 'stripe') {
    if (input.chargeIntent.currency === 'USD' || input.chargeIntent.currency === 'USDC') {
      return {
        eligibilityStatus: 'eligible',
        reasonTokens: ['stripe_currency_supported'],
        blockingConditionTokens: [],
        state: 'active',
      };
    }

    return {
      eligibilityStatus: 'incompatible',
      reasonTokens: ['stripe_currency_unsupported'],
      blockingConditionTokens: ['currency_mismatch'],
      state: 'blocked',
    };
  }

  if (input.binding.railClass === 'evm_wallet') {
    if (input.chargeIntent.currency === 'USDC' || input.chargeIntent.currency === 'ETH') {
      return {
        eligibilityStatus: 'eligible',
        reasonTokens: ['evm_wallet_native_currency'],
        blockingConditionTokens: [],
        state: 'active',
      };
    }

    if (input.chargeIntent.currency === 'USD') {
      return {
        eligibilityStatus: 'conditionally_eligible',
        reasonTokens: ['evm_wallet_requires_fiat_token_conversion'],
        blockingConditionTokens: ['conversion_required'],
        state: 'active',
      };
    }

    return {
      eligibilityStatus: 'incompatible',
      reasonTokens: ['evm_wallet_currency_unsupported'],
      blockingConditionTokens: ['currency_mismatch'],
      state: 'blocked',
    };
  }

  if (input.binding.railClass === 'erebor') {
    if (amount > 1000000) {
      return {
        eligibilityStatus: 'blocked',
        reasonTokens: ['erebor_limit_exceeded'],
        blockingConditionTokens: ['amount_limit_exceeded'],
        state: 'blocked',
      };
    }

    if (input.chargeIntent.currency === 'USD') {
      return {
        eligibilityStatus: 'eligible',
        reasonTokens: ['erebor_usd_supported'],
        blockingConditionTokens: [],
        state: 'active',
      };
    }

    return {
      eligibilityStatus: 'inconclusive',
      reasonTokens: ['erebor_currency_review_required'],
      blockingConditionTokens: ['manual_currency_review'],
      state: 'inconclusive',
    };
  }

  return {
    eligibilityStatus: 'inconclusive',
    reasonTokens: ['unknown_rail'],
    blockingConditionTokens: ['unknown_rail'],
    state: 'inconclusive',
  };
}

export function deriveRailEligibilityForBindings(input: {
  chargeIntent: ChargeIntent;
  railBindings: RailBinding[];
}): RailEligibility[] {
  return input.railBindings.map((binding) => {
    const evaluated = evaluateEligibility({
      chargeIntent: input.chargeIntent,
      binding,
    });

    const reasonTokens = uniqueSorted(evaluated.reasonTokens);
    const blockingConditionTokens = uniqueSorted(evaluated.blockingConditionTokens);

    return {
      railEligibilityId: deriveRailEligibilityId({
        chargeIntentId: input.chargeIntent.chargeIntentId,
        railBindingId: binding.railBindingId,
        eligibilityStatus: evaluated.eligibilityStatus,
        reasonTokens,
        blockingConditionTokens,
      }),
      chargeIntentId: input.chargeIntent.chargeIntentId,
      railBindingId: binding.railBindingId,
      eligibilityStatus: evaluated.eligibilityStatus,
      reasonTokens,
      blockingConditionTokens,
      state: evaluated.state,
    };
  }).sort((left, right) => left.railEligibilityId.localeCompare(right.railEligibilityId));
}
