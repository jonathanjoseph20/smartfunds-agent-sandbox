import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runAutonomousRetry } from './autonomous-retry.ts';

describe('autonomous retry (local)', () => {
  it('patches missing Risk Tier once and passes on rerun', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-retry-'));
    const bodyFile = path.join(tempDir, '.pr-body.md');
    fs.writeFileSync(
      bodyFile,
      `tier-1

\`\`\`evidence
Justification: local test
Affected Paths: apps/api/src/index.ts
Tests Added: npm test
Determinism Statement: deterministic
\`\`\`
`
    );

    const result = await runAutonomousRetry({
      bodyFile,
      maxRetries: 1,
      dryRun: false,
      changedFiles: ['apps/api/src/index.ts'],
      commitAndPush: false
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.retryTrace).toEqual({
      attempted: true,
      retryCount: 1,
      initialStatus: 'failed',
      finalStatus: 'passed',
      triggerErrorCode: 'MISSING_EVIDENCE_FIELD',
      retryable: true,
      patchApplied: 'ADD_EVIDENCE_RISK_TIER'
    });

    const nextBody = fs.readFileSync(bodyFile, 'utf8');
    expect(nextBody).toContain('Risk Tier: 1');
  });
});
