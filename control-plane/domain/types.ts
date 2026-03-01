export interface ReceiptInput {
  subscriptionId: string;
  dealId: string;
  entityId: string;
  railType: 'evm_usdc' | 'wire';
  amount: string;
  currency: 'USDC' | 'USD';
  payerRef: string;
  receiptRef: string;
  toAccountRef: string;
  chainId?: number;
}
