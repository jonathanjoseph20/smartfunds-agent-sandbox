import { describe, expect, it } from 'vitest';

import { deriveProductFactoryDocsCompleteness } from '../../product-factory-release/product-factory-docs-completeness.ts';

describe('product factory docs completeness', () => {
  it('T-PF9-D1 docs_complete', () => {
    const requiredDocumentIds = ['docs/a.md', 'docs/b.md'];
    const result = deriveProductFactoryDocsCompleteness({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      requiredDocumentIds,
      presentDocumentIds: requiredDocumentIds,
    });

    expect(result.completenessClass).toBe('docs_complete');
  });

  it('T-PF9-D2 docs_missing', () => {
    const result = deriveProductFactoryDocsCompleteness({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      requiredDocumentIds: ['docs/a.md'],
      presentDocumentIds: [],
    });

    expect(result.completenessClass).toBe('docs_missing');
  });

  it('T-PF9-D3 docs_partial', () => {
    const result = deriveProductFactoryDocsCompleteness({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      requiredDocumentIds: ['docs/a.md', 'docs/b.md'],
      presentDocumentIds: ['docs/a.md'],
    });

    expect(result.completenessClass).toBe('docs_partially_complete');
  });
});
