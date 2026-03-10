import fs from 'node:fs';
import { stringifyGovernanceReport } from './governance/diagnostics.ts';
import { renderGovernanceFailureSummary } from './governance/failure-output.ts';
import { runGovernanceValidation } from './governance/validate.ts';

function hasSelfCheckFlag(argv: string[]): boolean {
  return argv.includes('--self-check');
}

function resolveMode(argv: string[]): 'route' | 'lite' | 'full' {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') {
      const value = argv[index + 1];
      if (value === 'route' || value === 'lite' || value === 'full') {
        return value;
      }
      throw new Error('Missing or invalid value for --mode. Use route, lite, or full.');
    }
    if (arg.startsWith('--mode=')) {
      const value = arg.slice('--mode='.length);
      if (value === 'route' || value === 'lite' || value === 'full') {
        return value;
      }
      throw new Error('Invalid --mode value. Use route, lite, or full.');
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
  console.log(`Detected profile: ${result.routing.profile}`);
  console.log(`Requested profile: ${result.routing.requestedProfile}`);
  console.log(`Required profile: ${result.routing.requiredProfile}`);
  console.log(`Final profile: ${result.routing.finalProfile}`);
  console.log(`Matched scope: ${result.routing.matchedScopes.join(', ') || 'none'}`);
  console.log(`Routing governance: ${result.routing.finalProfile}`);

  if (!result.ok) {
    console.error('GOVERNANCE STATUS: FAIL');
    console.error(`Reason: ${result.errors[0] ?? 'Governance validation failed.'}`);
    console.error(`Suggested Action: ${result.primaryAction ?? 'Address governance violations and rerun validation.'}`);
    console.error('');
    console.error(
      renderGovernanceFailureSummary({
        report: result.report,
        errors: result.errors,
        primaryAction: result.primaryAction
      })
    );
    console.error('');
    console.error('Technical Metadata:');
    console.error('GOVERNANCE_REPORT_JSON_START');
    console.error(stringifyGovernanceReport(result.report));
    console.error('GOVERNANCE_REPORT_JSON_END');
    return 1;
  }

  const outputPath = process.env.GITHUB_OUTPUT;
  const finalTier = Math.max(result.report.labelTier ?? result.report.impliedTier ?? 0, result.report.impliedTier ?? 0);
  if (outputPath) {
    fs.appendFileSync(outputPath, `tier=${result.report.labelTier ?? ''}\n`);
    fs.appendFileSync(outputPath, `detected_tier=${result.report.labelTier ?? ''}\n`);
    fs.appendFileSync(outputPath, `implied_tier=${result.report.impliedTier}\n`);
    fs.appendFileSync(outputPath, `final_tier=${finalTier}\n`);
    fs.appendFileSync(outputPath, `mode=${mode}\n`);
    fs.appendFileSync(outputPath, `required_checks=${result.report.requiredChecks.join(',')}\n`);
    fs.appendFileSync(outputPath, `profile=${result.routing.profile}\n`);
    fs.appendFileSync(outputPath, `requested_profile=${result.routing.requestedProfile}\n`);
    fs.appendFileSync(outputPath, `required_profile=${result.routing.requiredProfile}\n`);
    fs.appendFileSync(outputPath, `final_profile=${result.routing.finalProfile}\n`);
    fs.appendFileSync(outputPath, `matched_scopes=${result.routing.matchedScopes.join(',')}\n`);
    fs.appendFileSync(outputPath, `routing_source=${result.routing.source}\n`);
  }

  console.log('GOVERNANCE STATUS: PASS');
  console.log(
    `Reason: PR governance validation passed in ${mode} mode with profile ${result.routing.finalProfile} and label tier-${result.report.labelTier ?? 'n/a'} (implied tier-${result.report.impliedTier}, final tier-${finalTier}).`
  );
  console.log('Suggested Action: Continue CI progression.');
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
