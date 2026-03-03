export const REQUIRED_EVIDENCE_FIELDS = [
  'tier',
  'mode',
  'determinismStatement',
  'retrySemanticsModified',
  'autonomyScopeExpanded',
  'affectedPaths'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasNestedEvidenceField(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const nested = value.evidence;
  if (!isRecord(nested)) {
    return false;
  }
  return Object.hasOwn(nested, 'evidence');
}

export function validateEvidenceShape(value: unknown): string[] {
  if (!isRecord(value)) {
    return ['evidence must be a JSON object.'];
  }

  const errors: string[] = [];
  for (const requiredField of REQUIRED_EVIDENCE_FIELDS) {
    if (!Object.hasOwn(value, requiredField)) {
      errors.push(`evidence.${requiredField} is required.`);
    }
  }

  if (hasNestedEvidenceField(value)) {
    errors.push('evidence.evidence is not allowed.');
  }

  return errors.sort((left, right) => left.localeCompare(right));
}
