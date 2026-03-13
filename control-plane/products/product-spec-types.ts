export type ProductSpecStatus =
  | 'incomplete'
  | 'draft'
  | 'validated'
  | 'blocked';

export type ProductSpecValidation = {
  validationState: 'valid' | 'invalid' | 'incomplete';
  missingFields: string[];
  constraintViolations: string[];
  warnings: string[];
};

export type ProductSpecHistoryEvent = {
  eventType:
    | 'product_spec_created'
    | 'product_spec_updated'
    | 'product_spec_validated'
    | 'product_spec_status_changed';
  specId: string;
  payloadHash: string;
};

export type ProductSpec = {
  specId: string;
  name: string;
  problem: string;
  targetUser: string;
  solution: string;
  architectureSummary?: string;
  mvpScope: string;
  constraints?: string[];
  dependencies?: string[];
  originMissionIds: string[];
  status: ProductSpecStatus;
};

export type ProductSpecProjection = {
  specId: string;
  name: string;
  status: ProductSpecStatus;
  validationState: string;
  missingFields: string[];
  warnings: string[];
  originMissionIds: string[];
};
