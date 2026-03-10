import type { EvidenceValidationResult, ParsedEvidence } from './types.ts';

export function validateParsedEvidence(parsed: ParsedEvidence): EvidenceValidationResult {
  const warnings: string[] = [];

  if (parsed.tierLine !== null) {
    warnings.push(`Legacy tier metadata detected: ${parsed.tierLine}.`);
  }

  if (parsed.evidenceFound) {
    warnings.push('Legacy evidence block detected.');
  }

  if (parsed.requiredMissing.length > 0) {
    warnings.push(`Legacy evidence fields missing: ${parsed.requiredMissing.join(', ')}.`);
  }

  if (parsed.unsupportedKeys.length > 0) {
    warnings.push(`Legacy evidence fields ignored: ${parsed.unsupportedKeys.join(', ')}.`);
  }

  if (parsed.formatErrors.length > 0) {
    warnings.push(`Legacy evidence format issues ignored: ${parsed.formatErrors.join(', ')}.`);
  }

  return {
    isValid: true,
    errors: [],
    warnings: [...new Set(warnings)].sort((a, b) => a.localeCompare(b))
  };
}
