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
      'Usage: npm run swarm:task -- [--execution-mode structured|autonomous] [--dry-run] [--print-report] [--help]\n'
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
      '{"executionMode":"autonomous","mode":"dry-run","printReport":false,"steps":["Validate CLI inputs","Compute deterministic task plan","Skip PR open/edit operations","Skip CI polling","Skip retry mutation"]}\n'
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
          eligible: false,
          ineligibleReason: 'RETRY_ALREADY_CONSUMED',
          trigger: { failingCheckName: null, governanceErrorCode: null },
          retryContext: { consumed: true, retriableErrorCode: null },
          action: { patchApplied: null, promptAmendmentApplied: false },
          finalStatus: 'failed'
        }
      }
    }));

    const code = await main(['--execution-mode=autonomous', '--print-report'], { spawnTaskFn: spawnTaskFn as never });

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe(
      '{"ci":{"normalized":{"checks":[],"ciStatus":"failed","failedChecks":[],"governingFailure":null,"governingReason":null}},"executionMode":"autonomous","pr":{"headSha":null,"number":41},"retry":{"action":{"patchApplied":null,"promptAmendmentApplied":false},"eligible":false,"finalStatus":"failed","ineligibleReason":"RETRY_ALREADY_CONSUMED","retryContext":{"consumed":true,"retriableErrorCode":null},"retryCount":1,"trigger":{"failingCheckName":null,"governanceErrorCode":null}},"version":1}\n'
    );
  });

  it('unknown arg returns deterministic error message', () => {
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown argument: --unknown');
  });
});
