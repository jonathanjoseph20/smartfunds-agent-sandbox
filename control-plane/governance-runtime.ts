import fs from 'node:fs';
import { stringifyGovernanceReport } from './governance/diagnostics.ts';
import { runGovernanceValidation } from './governance/validate.ts';

function hasSelfCheckFlag(argv: string[]): boolean {
  return argv.includes('--self-check');
}

function resolveMode(argv: string[]): 'lite' | 'full' {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') {
      const value = argv[index + 1];
      if (value === 'lite' || value === 'full') {
        return value;
      }
      throw new Error('Missing or invalid value for --mode. Use lite or full.');
    }
    if (arg.startsWith('--mode=')) {
      const value = arg.slice('--mode='.length);
      if (value === 'lite' || value === 'full') {
        return value;
      }
      throw new Error('Invalid --mode value. Use lite or full.');
    }
  }
  return 'full';
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

  const mode = resolveMode(argv);
  const result = await runGovernanceValidation({ mode });
  writeStepSummary(result.summaryText);
  for (const warning of result.report.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (!result.ok) {
    console.error('Governance validation failed.');
    console.error(
      `Declared Tier: ${result.report.declaredTier ?? 'n/a'} | Label Tier: ${result.report.labelTier ?? 'n/a'} | Implied Tier: ${result.report.impliedTier ?? 'n/a'} | Final Tier: ${Math.max(result.report.labelTier ?? result.report.impliedTier ?? 0, result.report.impliedTier ?? 0)}`
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
  const finalTier = Math.max(result.report.labelTier ?? result.report.impliedTier ?? 0, result.report.impliedTier ?? 0);
  if (outputPath) {
    fs.appendFileSync(outputPath, `tier=${result.report.labelTier}\n`);
    fs.appendFileSync(outputPath, `detected_tier=${result.report.labelTier}\n`);
    fs.appendFileSync(outputPath, `implied_tier=${result.report.impliedTier}\n`);
    fs.appendFileSync(outputPath, `final_tier=${finalTier}\n`);
    fs.appendFileSync(outputPath, `mode=${mode}\n`);
    fs.appendFileSync(outputPath, `required_checks=${result.report.requiredChecks.join(',')}\n`);
  }

  console.log(
    `PR governance validation passed in ${mode} mode with label tier-${result.report.labelTier ?? 'n/a'} (implied tier-${result.report.impliedTier}, final tier-${finalTier}). Required checks: ${result.report.requiredChecks.join(', ')}`
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
