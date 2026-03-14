import { getCommerceRule } from './commerce-registry.ts';
import { deriveChargeIntentId } from './charge-intent-identity.ts';
import { asAmountString, normalizeString, uniqueSortedRails } from './commerce-normalizer.ts';
import type { ChargeIntent, ChargeIntentCreateInput, MonetizationClass } from './charge-intent-types.ts';

export type CommerceUpstreamContext = {
  buildEvidenceBundleId: string;
  runId: string;
  packetId: string;
  bundleId: string;
  graphId: string;
  taskId: string;
  planId: string;
  productSpecId: string;
};

export function createChargeIntentRecord(input: {
  create: ChargeIntentCreateInput;
  upstream: CommerceUpstreamContext;
}): ChargeIntent {
  const monetizationClass: MonetizationClass = input.create.monetizationClass ?? 'artifact_delivery';
  const rule = getCommerceRule(monetizationClass);

  const amount = asAmountString(input.create.amount ?? rule.amount);
  const currency = normalizeString(input.create.currency ?? rule.currency).toUpperCase();
  const payTo = normalizeString(input.create.payTo ?? rule.payTo);
  const railClasses = uniqueSortedRails(input.create.railClasses ?? rule.railClasses);

  const chargeIntentId = deriveChargeIntentId({
    buildEvidenceBundleId: input.upstream.buildEvidenceBundleId,
    runId: input.upstream.runId,
    packetId: input.upstream.packetId,
    bundleId: input.upstream.bundleId,
    graphId: input.upstream.graphId,
    taskId: input.upstream.taskId,
    planId: input.upstream.planId,
    productSpecId: input.upstream.productSpecId,
    monetizationClass,
    amount,
    currency,
    payTo,
    railClasses,
  });

  return {
    chargeIntentId,
    buildEvidenceBundleId: input.upstream.buildEvidenceBundleId,
    runId: input.upstream.runId,
    packetId: input.upstream.packetId,
    bundleId: input.upstream.bundleId,
    graphId: input.upstream.graphId,
    taskId: input.upstream.taskId,
    planId: input.upstream.planId,
    productSpecId: input.upstream.productSpecId,
    monetizationClass,
    amount,
    currency,
    payTo,
    railClasses,
    status: 'draft',
    outcome: amount === '0.00' ? 'no_charge' : 'pending_settlement',
  };
}
