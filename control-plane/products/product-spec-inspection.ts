import { createProductSpecManager } from './product-spec-manager.ts';
import type { ProductSpecProjection } from './product-spec-types.ts';

type ProductSpecInspectionManager = ReturnType<typeof createProductSpecManager>;

export function createProductSpecInspection(options: {
  manager?: ProductSpecInspectionManager;
  specsFilePath?: string;
  historyFilePath?: string;
} = {}) {
  const manager = options.manager ?? createProductSpecManager({
    specsFilePath: options.specsFilePath,
    historyFilePath: options.historyFilePath,
  });

  function listProductSpecs(): ProductSpecProjection[] {
    return manager.listProductSpecProjections();
  }

  function getProductSpec(specId: string): ProductSpecProjection {
    return manager.deriveProductSpecProjection(specId);
  }

  function inspectProductSpec(specId: string): ProductSpecProjection {
    return manager.deriveProductSpecProjection(specId);
  }

  return {
    listProductSpecs,
    getProductSpec,
    inspectProductSpec,
  };
}

export type ProductSpecInspection = ReturnType<typeof createProductSpecInspection>;
