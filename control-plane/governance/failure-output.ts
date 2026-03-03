import type { GovernanceReport } from './diagnostics.ts';

type FailureSummaryInput = {
  report: GovernanceReport;
  errors: string[];
  primaryAction: string | null;
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function extractPrimaryViolation(report: GovernanceReport, errors: string[]): string {
  if (report.modeViolation === 'mixed_execution_modes') {
    return 'Mixed execution modes detected.';
  }
  if (errors.length > 0) {
    return errors[0];
  }
  return 'Governance validation failed.';
}

function toPrefixGlob(filePath: string): string {
  const slash = filePath.indexOf('/');
  if (slash <= 0) {
    return filePath;
  }
  return `${filePath.slice(0, slash)}/**`;
}

function buildMixedModeSplitSuggestion(report: GovernanceReport): {
  structuredGlobs: string[];
  autonomousGlobs: string[];
} {
  return {
    structuredGlobs: sortedUnique(report.structuredPathsTouched.map(toPrefixGlob)),
    autonomousGlobs: sortedUnique(report.autonomousPathsTouched.map(toPrefixGlob))
  };
}

function buildRecommendedAction(input: FailureSummaryInput, primaryViolation: string): string {
  const hasEvidenceDrift = input.errors.some((error) => error.includes('Evidence drift detected'));
  if (hasEvidenceDrift) {
    return [
      'npm run governance:emit',
      'git add governance/evidence.json',
      'git commit -m "fix(governance): canonicalize evidence"'
    ].join('\n');
  }

  if (input.report.modeViolation === 'mixed_execution_modes') {
    const split = buildMixedModeSplitSuggestion(input.report);
    return [
      `PR A: ${split.structuredGlobs.join(', ') || 'structured paths only'}`,
      `PR B: ${split.autonomousGlobs.join(', ') || 'autonomous paths only'}`
    ].join('\n');
  }

  return input.primaryAction ?? primaryViolation;
}

export function renderGovernanceFailureSummary(input: FailureSummaryInput): string {
  const lines: string[] = [];
  const primaryViolation = extractPrimaryViolation(input.report, input.errors);
  const recommendedAction = buildRecommendedAction(input, primaryViolation);
  const mixedModeSplit = buildMixedModeSplitSuggestion(input.report);

  lines.push('❌ GOVERNANCE FAILED');
  lines.push(`Primary Violation: ${primaryViolation}`);
  lines.push('');
  lines.push('Details:');

  if (input.report.modeViolation === 'mixed_execution_modes') {
    lines.push(` Structured paths (${input.report.structuredPathsTouched.length}):`);
    for (const file of input.report.structuredPathsTouched) {
      lines.push(` - ${file}`);
    }
    lines.push(` Autonomous paths (${input.report.autonomousPathsTouched.length}):`);
    for (const file of input.report.autonomousPathsTouched) {
      lines.push(` - ${file}`);
    }
    lines.push(' Suggested split:');
    lines.push(` PR A: ${mixedModeSplit.structuredGlobs.join(', ') || 'structured paths only'}`);
    lines.push(` PR B: ${mixedModeSplit.autonomousGlobs.join(', ') || 'autonomous paths only'}`);
  } else {
    lines.push(` Error count: ${input.errors.length}`);
    for (const error of input.errors.slice(0, 5)) {
      lines.push(` - ${error}`);
    }
  }

  lines.push('');
  lines.push('Recommended Action:');
  for (const line of recommendedAction.split('\n')) {
    lines.push(` ${line}`);
  }

  return lines.join('\n');
}
