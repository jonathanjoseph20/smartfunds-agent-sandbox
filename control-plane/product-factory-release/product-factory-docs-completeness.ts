import {
  deriveProductFactoryDocsCompletenessId,
} from './product-factory-release-acceptance-identity.ts';
import type {
  ProductFactoryDocsCompleteness,
  ProductFactoryReleaseState,
} from './product-factory-release-acceptance-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim().replace(/\\/g, '/')).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function toDocsState(completenessClass: ProductFactoryDocsCompleteness['completenessClass']): ProductFactoryReleaseState {
  if (completenessClass === 'docs_complete') {
    return 'accepted';
  }
  if (completenessClass === 'docs_partially_complete') {
    return 'partial';
  }
  if (completenessClass === 'docs_blocked') {
    return 'blocked';
  }
  if (completenessClass === 'docs_missing') {
    return 'failed';
  }
  return 'inconclusive';
}

export function deriveProductFactoryDocsCompleteness(input: {
  productFactoryReleaseAcceptanceRecordId: string;
  requiredDocumentIds: string[];
  presentDocumentIds: string[];
  blockedDocumentIds?: string[];
}): ProductFactoryDocsCompleteness {
  const requiredDocumentIds = uniqueSorted(input.requiredDocumentIds);
  const presentDocumentIds = uniqueSorted(input.presentDocumentIds)
    .filter((entry) => requiredDocumentIds.includes(entry));

  const blockedDocumentIds = uniqueSorted(input.blockedDocumentIds ?? [])
    .filter((entry) => requiredDocumentIds.includes(entry));

  const missingDocumentIds = requiredDocumentIds
    .filter((entry) => !presentDocumentIds.includes(entry) && !blockedDocumentIds.includes(entry));

  let completenessClass: ProductFactoryDocsCompleteness['completenessClass'] = 'docs_inconclusive';
  if (blockedDocumentIds.length > 0) {
    completenessClass = 'docs_blocked';
  } else if (requiredDocumentIds.length > 0 && presentDocumentIds.length === requiredDocumentIds.length) {
    completenessClass = 'docs_complete';
  } else if (requiredDocumentIds.length > 0 && presentDocumentIds.length > 0) {
    completenessClass = 'docs_partially_complete';
  } else if (requiredDocumentIds.length > 0 && missingDocumentIds.length > 0) {
    completenessClass = 'docs_missing';
  }

  const reasonTokens = uniqueSorted([
    ...missingDocumentIds.map((entry) => `missing_doc:${entry}`),
    ...blockedDocumentIds.map((entry) => `blocked_doc:${entry}`),
    completenessClass,
  ]);

  return {
    productFactoryDocsCompletenessId: deriveProductFactoryDocsCompletenessId({
      productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
      requiredDocumentIds,
      presentDocumentIds,
      completenessClass,
      reasonTokens,
    }),
    productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
    requiredDocumentIds,
    presentDocumentIds,
    completenessClass,
    reasonTokens,
    state: toDocsState(completenessClass),
  };
}
