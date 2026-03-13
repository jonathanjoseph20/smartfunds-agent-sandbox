import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import { createProductSpecManager } from './product-spec-manager.ts';
import { validateProductSpec } from './product-spec-validation.ts';

type ProductSpecMaterializerManager = ReturnType<typeof createProductSpecManager>;

const DEFAULT_PRODUCT_ARTIFACTS_ROOT = path.join('artifacts', 'products');

function toMarkdownReport(input: {
  spec: unknown;
  projection: unknown;
  validation: unknown;
  history: unknown;
}): string {
  const lines = [
    '# Product Spec Report',
    '',
    `${canonicalStringify(input)}`,
  ];

  return `${lines.join('\n')}\n`;
}

export function createProductSpecMaterializer(options: {
  manager?: ProductSpecMaterializerManager;
  artifactsRoot?: string;
  specsFilePath?: string;
  historyFilePath?: string;
} = {}) {
  const manager = options.manager ?? createProductSpecManager({
    specsFilePath: options.specsFilePath,
    historyFilePath: options.historyFilePath,
  });
  const artifactsRoot = options.artifactsRoot ?? DEFAULT_PRODUCT_ARTIFACTS_ROOT;

  function materializeProductSpec(specId: string): {
    specId: string;
    productSpecPath: string;
    statusPath: string;
    validationPath: string;
    reportPath: string;
  } {
    const spec = manager.getProductSpec(specId);
    const validation = validateProductSpec(spec);
    const projection = manager.deriveProductSpecProjection(specId);
    const history = manager.historyStore.listProductSpecEvents(specId);

    const dirPath = path.join(artifactsRoot, specId);
    fs.mkdirSync(dirPath, { recursive: true });

    const productSpecPath = path.join(dirPath, 'product-spec.json');
    const statusPath = path.join(dirPath, 'product-spec-status.json');
    const validationPath = path.join(dirPath, 'product-spec-validation.json');
    const reportPath = path.join(dirPath, 'product-spec-report.md');

    fs.writeFileSync(productSpecPath, `${canonicalStringify(spec)}\n`, 'utf8');
    fs.writeFileSync(statusPath, `${canonicalStringify({ specId, status: projection.status })}\n`, 'utf8');
    fs.writeFileSync(validationPath, `${canonicalStringify(validation)}\n`, 'utf8');
    fs.writeFileSync(reportPath, toMarkdownReport({ spec, projection, validation, history }), 'utf8');

    return {
      specId,
      productSpecPath,
      statusPath,
      validationPath,
      reportPath,
    };
  }

  return {
    materializeProductSpec,
  };
}

export type ProductSpecMaterializer = ReturnType<typeof createProductSpecMaterializer>;
