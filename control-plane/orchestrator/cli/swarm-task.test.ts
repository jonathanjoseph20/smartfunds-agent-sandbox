import { afterEach, describe, expect, it, vi } from 'vitest';

import { main, parseArgs } from './swarm-task.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('swarm-task CLI args', () => {
  it('--help exits 0 and prints usage', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const spawnTaskFn = vi.fn();

    const code = await main(['--help'], { spawnTaskFn: spawnTaskFn as never });

    expect(code).toBe(0);
    expect(spawnTaskFn).not.toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe(
      'Usage: npm run swarm:task -- [--execution-mode structured|autonomous] [--dry-run] [--print-report] [--print-plan] [--help]\n'
    );
  });

  it('--dry-run exits 0 and does not invoke PR/CI execution', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const spawnTaskFn = vi.fn();

    const code = await main(['--dry-run', '--execution-mode=autonomous'], { spawnTaskFn: spawnTaskFn as never });

    expect(code).toBe(0);
    expect(spawnTaskFn).not.toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe(
      '{"executionMode":"autonomous","mode":"dry-run","patchCommands":[],"patchPlan":{"governanceErrorCode":"N/A","ops":[{"op":"noop","reason":"dry_run_no_context"}],"retryAttempt":0,"version":"v1"},"printPlan":false,"printReport":false,"steps":["Validate CLI inputs","Compute deterministic task plan","Skip PR open/edit operations","Skip CI polling","Skip retry mutation"]}\n'
    );
  });

  it('--print-report writes only execution report payload', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const spawnTaskFn = vi.fn(async () => ({
      executionMode: 'autonomous',
      prNumber: 41,
      ciStatusInitial: 'failed',
      ciStatusFinal: 'passed',
      retryState: {
        retryEnabled: true,
        retryCount: 1,
        retryAttempted: true,
        triggerErrorCode: 'MISSING_TIER_LABEL',
        finalStatus: 'passed'
      },
      governanceReport: null,
      executionReportPath: '.orchestrator/reports/pr-41/execution-report.v1.json',
      executionReport: {
        version: 1,
        executionMode: 'autonomous',
        pr: { number: 41, headSha: null },
        ci: {
          normalized: {
            ciStatus: 'failed',
            checks: [],
            failedChecks: [],
            governingFailure: null,
            governingReason: null
          }
        },
        retry: {
          retryCount: 1,
          retryAttempt: 1,
          eligible: false,
          ineligibleReason: 'RETRY_ALREADY_CONSUMED',
          trigger: { failingCheckName: null, governanceErrorCode: null },
          retryContext: { consumed: true, retriableErrorCode: null },
          action: { patchApplied: null, promptAmendmentApplied: false },
          patchPlan: null,
          patchOutcomeCode: 'noop',
          patchAppliedOps: [],
          patchDryRun: false,
          patchCommands: [],
          finalStatus: 'failed'
        }
      }
    }));

    const code = await main(['--execution-mode=autonomous', '--print-report'], { spawnTaskFn: spawnTaskFn as never });

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe(
      '{"ci":{"normalized":{"checks":[],"ciStatus":"failed","failedChecks":[],"governingFailure":null,"governingReason":null}},"executionMode":"autonomous","pr":{"headSha":null,"number":41},"retry":{"action":{"patchApplied":null,"promptAmendmentApplied":false},"eligible":false,"finalStatus":"failed","ineligibleReason":"RETRY_ALREADY_CONSUMED","patchAppliedOps":[],"patchCommands":[],"patchDryRun":false,"patchOutcomeCode":"noop","patchPlan":null,"retryAttempt":1,"retryContext":{"consumed":true,"retriableErrorCode":null},"retryCount":1,"trigger":{"failingCheckName":null,"governanceErrorCode":null}},"version":1}\n'
    );
  });

  it('--print-plan writes patch plan payload', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const spawnTaskFn = vi.fn(async () => ({
      retryState: { finalStatus: 'passed' },
      executionReport: {
        retry: {
          patchPlan: { version: 'v1', governanceErrorCode: 'MISSING_TIER_LABEL', retryAttempt: 0, ops: [] },
          patchCommands: ['gh pr edit 41 --add-label "tier-3"'],
          patchDryRun: false
        }
      }
    }));

    const code = await main(['--print-plan'], { spawnTaskFn: spawnTaskFn as never });

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe(
      '{"patchCommands":["gh pr edit 41 --add-label \\"tier-3\\""],"patchDryRun":false,"patchPlan":{"governanceErrorCode":"MISSING_TIER_LABEL","ops":[],"retryAttempt":0,"version":"v1"}}\n'
    );
  });

  it('unknown arg returns deterministic error message', () => {
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown argument: --unknown');
  });
});
