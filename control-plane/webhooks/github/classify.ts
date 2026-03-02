import type { FailureClass } from './types.ts';

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function classifyFailure(input: {
  checkName: string;
}): FailureClass {
  const name = normalizeName(input.checkName);

  if (name.includes('policy') || name.includes('validate pr') || name.includes('governance')) {
    return 'governance_failure';
  }
  if (name.includes('unit')) {
    return 'unit_test_failure';
  }
  if (name.includes('integration')) {
    return 'integration_test_failure';
  }
  if (name.includes('lint') || name.includes('typecheck')) {
    return 'lint_failure';
  }
  if (name.includes('schema')) {
    return 'schema_failure';
  }
  if (name.includes('rail')) {
    return 'rail_enforcement_failure';
  }

  return 'unknown_failure';
}
