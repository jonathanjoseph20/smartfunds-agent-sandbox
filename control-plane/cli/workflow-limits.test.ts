import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-limits.ts';

describe('workflow-limits CLI', () => {
  it('prints deterministic effective limits', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      maxContextSize: 100000,
      maxNodesPerWorkflow: 50,
      maxRetriesPerNode: 3,
      maxTotalRetriesPerWorkflow: 25,
      maxWorkflowRuntimeSeconds: 3600
    })}\n`);
    stdout.mockRestore();
  });

  it('returns error for unknown argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main(['--bad']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' })}\n`);
    stdout.mockRestore();
  });
});
