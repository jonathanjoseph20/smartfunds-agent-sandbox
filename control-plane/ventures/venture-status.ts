import type {
  VentureDefinition,
  VentureStatusProjection,
  VentureValidationResult,
} from './venture-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function deriveVentureStatus(input: {
  definition: VentureDefinition;
  validation: VentureValidationResult;
}): VentureStatusProjection {
  const { definition, validation } = input;
  const findings = validation.findings;
  const codes = new Set(findings.map((finding) => finding.code));

  const blockingReasons = uniqueSorted([
    ...definition.blockingReasons,
    ...findings
      .filter((finding) => [
        'required',
        'invalid_enum',
        'invalid_slug',
        'ownership_contradiction',
        'invalid_operating_mode_for_class',
        'provenance_missing_source',
        'provenance_missing_reference_ids',
        'invalid_venture_name',
      ].includes(finding.code))
      .map((finding) => `${finding.field}:${finding.code}`),
  ]);

  const limitations = uniqueSorted([
    ...definition.limitations,
    ...findings
      .filter((finding) => [
        'missing_origin_missions',
        'missing_domain_tags',
        'missing_product_type_tags',
        'invalid_mission_reference',
        'invalid_team_reference',
        'invalid_entity_reference',
        'classification_inconclusive',
      ].includes(finding.code))
      .map((finding) => `${finding.field}:${finding.code}`),
  ]);

  let ventureStatus: VentureStatusProjection['ventureStatus'];

  if (blockingReasons.length > 0) {
    ventureStatus = 'blocked';
  } else if (codes.has('classification_inconclusive')) {
    ventureStatus = 'inconclusive';
  } else if (codes.has('missing_origin_missions') || codes.has('missing_domain_tags') || codes.has('missing_product_type_tags')) {
    ventureStatus = 'incomplete';
  } else if (codes.has('invalid_mission_reference') || codes.has('invalid_team_reference') || codes.has('invalid_entity_reference')) {
    ventureStatus = 'manual_review_required';
  } else {
    ventureStatus = definition.ventureStatus ?? 'active';
  }

  return {
    ventureId: definition.ventureId ?? '',
    ventureLifecycleState: definition.ventureLifecycleState,
    ventureStatus,
    limitations,
    blockingReasons,
  };
}
