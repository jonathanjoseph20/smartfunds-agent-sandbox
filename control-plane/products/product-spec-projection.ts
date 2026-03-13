import type {
  ProductSpec,
  ProductSpecHistoryEvent,
  ProductSpecProjection,
  ProductSpecValidation,
} from './product-spec-types.ts';

type ProductSpecProjectionInput = {
  spec: ProductSpec;
  validation: ProductSpecValidation;
  historyEvents: ProductSpecHistoryEvent[];
};

export function projectProductSpec(input: ProductSpecProjectionInput): ProductSpecProjection {
  return {
    specId: input.spec.specId,
    name: input.spec.name,
    status: input.spec.status,
    validationState: input.validation.validationState,
    missingFields: [...input.validation.missingFields].sort((left, right) => left.localeCompare(right)),
    warnings: [...input.validation.warnings].sort((left, right) => left.localeCompare(right)),
    originMissionIds: [...input.spec.originMissionIds].sort((left, right) => left.localeCompare(right)),
  };
}
