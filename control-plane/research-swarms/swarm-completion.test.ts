import { describe, expect, it } from 'vitest';

import { evaluateCompletionRules, isSwarmComplete } from './swarm-completion.ts';

describe('swarm completion evaluation', () => {
  it('T-SW-C1 marks complete only when all required rules are satisfied', () => {
    const complete = evaluateCompletionRules({
      swarmId: 'protocol-risk-response',
      completionRules: {
        requireAllInvestigationsComplete: true,
        requireResolvedConflicts: true
      },
      investigations: [
        { investigationRunId: 'run-1', status: 'completed' },
        { investigationRunId: 'run-2', status: 'completed' }
      ],
      unresolvedConflictCount: 0
    });

    expect(complete.isComplete).toBe(true);
    expect(complete.unmetRules).toEqual([]);
  });

  it('T-SW-C2 reports unmet rules deterministically', () => {
    const incomplete = evaluateCompletionRules({
      swarmId: 'protocol-risk-response',
      completionRules: {
        requireAllInvestigationsComplete: true,
        requireResolvedConflicts: true
      },
      investigations: [
        { investigationRunId: 'run-1', status: 'running' }
      ],
      unresolvedConflictCount: 1
    });

    expect(incomplete.isComplete).toBe(false);
    expect(incomplete.unmetRules).toEqual(['requireAllInvestigationsComplete', 'requireResolvedConflicts']);
    expect(isSwarmComplete({
      swarmId: 'protocol-risk-response',
      completionRules: {
        requireAllInvestigationsComplete: true,
        requireResolvedConflicts: true
      },
      investigations: [{ investigationRunId: 'run-1', status: 'running' }],
      unresolvedConflictCount: 1
    })).toBe(false);
  });
});
