import type {
  MonetizationClass,
  RailClass,
} from './charge-intent-types.ts';

export type CommerceRule = {
  monetizationClass: MonetizationClass;
  amount: string;
  currency: string;
  payTo: string;
  railClasses: RailClass[];
};

const COMMERCE_RULES: CommerceRule[] = [
  {
    monetizationClass: 'product_access',
    amount: '199.00',
    currency: 'USD',
    payTo: 'smartfunds::product-access',
    railClasses: ['stripe', 'evm_wallet'],
  },
  {
    monetizationClass: 'service_execution',
    amount: '750.00',
    currency: 'USD',
    payTo: 'smartfunds::service-execution',
    railClasses: ['stripe', 'erebor'],
  },
  {
    monetizationClass: 'artifact_delivery',
    amount: '99.00',
    currency: 'USD',
    payTo: 'smartfunds::artifact-delivery',
    railClasses: ['stripe', 'evm_wallet', 'erebor'],
  },
  {
    monetizationClass: 'subscription',
    amount: '49.00',
    currency: 'USD',
    payTo: 'smartfunds::subscription',
    railClasses: ['stripe', 'evm_wallet'],
  },
  {
    monetizationClass: 'internal_billing',
    amount: '0.00',
    currency: 'USD',
    payTo: 'smartfunds::internal-billing',
    railClasses: ['stripe'],
  },
];

export function listCommerceRules(): CommerceRule[] {
  return [...COMMERCE_RULES].sort((left, right) => left.monetizationClass.localeCompare(right.monetizationClass));
}

export function getCommerceRule(monetizationClass: MonetizationClass): CommerceRule {
  const rule = COMMERCE_RULES.find((entry) => entry.monetizationClass === monetizationClass);
  if (!rule) {
    throw new Error(`COMMERCE_RULE_NOT_FOUND: ${monetizationClass}`);
  }

  return {
    ...rule,
    railClasses: [...rule.railClasses].sort((left, right) => left.localeCompare(right)),
  };
}
