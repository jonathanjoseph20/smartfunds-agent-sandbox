import type { EvidenceValidationResult, ParsedEvidence } from './types.ts';

function sortErrors<T extends { code: string; message: string }>(errors: T[]): T[] {
  return [...errors].sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) {
      return codeCompare;
    }
    return a.message.localeCompare(b.message);
  });
}

export function validateParsedEvidence(parsed: ParsedEvidence): EvidenceValidationResult {
  const errors: EvidenceValidationResult['errors'] = [];
  const invalidTier = parsed.formatErrors.find((value) => value.startsWith('INVALID_TIER_LABEL:'));

  if (parsed.tierLine === null) {
    if (invalidTier) {
      errors.push({
        code: 'INVALID_TIER_LABEL',
        message: invalidTier,
        details: { invalidTier }
      });
    } else {
      errors.push({
        code: 'MISSING_TIER_LABEL',
        message: 'Missing unfenced tier label line (tier-0..tier-3).'
      });
    }
  }

  if (!parsed.evidenceFound) {
    errors.push({
      code: 'MISSING_EVIDENCE_BLOCK',
      message: 'Missing evidence block fenced with exact lines ```evidence and ```.'
    });
  }

  if (parsed.requiredMissing.length > 0) {
    errors.push({
      code: 'MISSING_EVIDENCE_FIELDS',
      message: `Missing required evidence fields: ${parsed.requiredMissing.join(', ')}.`,
      details: { missingFields: parsed.requiredMissing }
    });
  }

  if (parsed.unsupportedKeys.length > 0) {
    errors.push({
      code: 'UNSUPPORTED_EVIDENCE_FIELDS',
      message: `Unsupported evidence fields: ${parsed.unsupportedKeys.join(', ')}.`,
      details: { unsupportedFields: parsed.unsupportedKeys }
    });
  }

  if (parsed.formatErrors.length > 0) {
    errors.push({
      code: 'EVIDENCE_FORMAT_ERROR',
      message: `Evidence format errors: ${parsed.formatErrors.join(', ')}.`,
      details: { formatErrors: parsed.formatErrors }
    });
  }

  const sortedErrors = sortErrors(errors);

  return {
    isValid:
      parsed.tierLine !== null &&
      parsed.evidenceFound &&
      parsed.requiredMissing.length === 0 &&
      parsed.unsupportedKeys.length === 0 &&
      parsed.formatErrors.length === 0,
    errors: sortedErrors,
    warnings: []
  };
}
