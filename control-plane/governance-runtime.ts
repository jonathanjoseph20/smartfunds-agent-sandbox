import fs from 'node:fs';
import { stringifyGovernanceReport } from './governance/diagnostics.ts';
import { runGovernanceValidation } from './governance/validate.ts';

function hasSelfCheckFlag(argv: string[]): boolean {
  return argv.includes('--self-check');
}

function writeStepSummary(summaryText: string): void {
  if (process.env.GOVERNANCE_SUMMARY === 'false') {
    return;
  }
  const outputPath = process.env.GITHUB_STEP_SUMMARY;
  if (!outputPath) {
    return;
  }
  fs.appendFileSync(outputPath, `${summaryText}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (hasSelfCheckFlag(argv)) {
    console.log('ok');
    return 0;
  }

  const result = await runGovernanceValidation();
  writeStepSummary(result.summaryText);

  if (!result.ok) {
    console.error('Governance validation failed.');
    console.error(
      `Declared Tier: ${result.report.declaredTier ?? 'n/a'} | Label Tier: ${result.report.labelTier ?? 'n/a'} | Implied Tier: ${result.report.impliedTier ?? 'n/a'}`
    );
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    console.error('GOVERNANCE_REPORT_JSON_START');
    console.error(stringifyGovernanceReport(result.report));
    console.error('GOVERNANCE_REPORT_JSON_END');
    return 1;
  }

  if (result.report.labelTier === null) {
    throw new Error('Unexpected state: tier label not resolved after validation.');
  }

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `tier=${result.report.labelTier}\n`);
    fs.appendFileSync(outputPath, `detected_tier=${result.report.labelTier}\n`);
    fs.appendFileSync(outputPath, `implied_tier=${result.report.impliedTier}\n`);
    fs.appendFileSync(outputPath, `required_checks=${result.report.requiredChecks.join(',')}\n`);
  }

  console.log(
    `PR governance validation passed with tier-${result.report.labelTier} (implied tier-${result.report.impliedTier}). Required checks: ${result.report.requiredChecks.join(', ')}`
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(2);
  });
}
