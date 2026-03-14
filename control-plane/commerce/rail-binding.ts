import { deriveRailBindingId } from './charge-intent-identity.ts';
import { uniqueSorted } from './commerce-normalizer.ts';
import type { ChargeIntent, RailBinding } from './charge-intent-types.ts';

function deriveBindingState(bindingClass: RailBinding['bindingClass']): RailBinding['state'] {
  if (bindingClass === 'blocked_binding') {
    return 'blocked';
  }

  return 'active';
}

export function deriveRailBindingsForChargeIntent(chargeIntent: ChargeIntent): RailBinding[] {
  const orderedRails = [...chargeIntent.railClasses].sort((left, right) => left.localeCompare(right));
  if (orderedRails.length === 0) {
    const reasonTokens = ['no_rail_declared'];
    return [{
      railBindingId: deriveRailBindingId({
        chargeIntentId: chargeIntent.chargeIntentId,
        railClass: 'stripe',
        bindingClass: 'blocked_binding',
        reasonTokens,
      }),
      chargeIntentId: chargeIntent.chargeIntentId,
      railClass: 'stripe',
      bindingClass: 'blocked_binding',
      reasonTokens,
      state: 'blocked',
    }];
  }

  return orderedRails.map((railClass, index) => {
    const bindingClass = index === 0 ? 'primary_binding' : 'fallback_binding';
    const reasonTokens = uniqueSorted([
      index === 0 ? 'primary_rail_selected' : 'fallback_rail_selected',
      `rail:${railClass}`,
    ]);

    return {
      railBindingId: deriveRailBindingId({
        chargeIntentId: chargeIntent.chargeIntentId,
        railClass,
        bindingClass,
        reasonTokens,
      }),
      chargeIntentId: chargeIntent.chargeIntentId,
      railClass,
      bindingClass,
      reasonTokens,
      state: deriveBindingState(bindingClass),
    };
  }).sort((left, right) => left.railBindingId.localeCompare(right.railBindingId));
}
