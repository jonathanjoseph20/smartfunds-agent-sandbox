import { describe, expect, it } from 'vitest';

import {
  deriveImplementationTaskGraphStatus,
  ImplementationTaskGraphStatus,
} from '../../tasks/task-graph-status.ts';

describe('implementation task graph status', () => {
  it('T-PF3-S1 derives incomplete from missing plan fields', () => {
    expect(deriveImplementationTaskGraphStatus({
      planValidation: {
        validationState: 'incomplete',
        missingFields: ['implementationPhases'],
        constraintViolations: [],
        warnings: [],
      },
      historyEvents: [],
    })).toBe(ImplementationTaskGraphStatus.INCOMPLETE);
  });

  it('T-PF3-S2 derives blocked from plan violations', () => {
    expect(deriveImplementationTaskGraphStatus({
      planValidation: {
        validationState: 'invalid',
        missingFields: [],
        constraintViolations: ['subsystems_contains_duplicates'],
        warnings: [],
      },
      historyEvents: [],
    })).toBe(ImplementationTaskGraphStatus.BLOCKED);
  });

  it('T-PF3-S3 derives materialized when history includes materialized event', () => {
    expect(deriveImplementationTaskGraphStatus({
      planValidation: {
        validationState: 'valid',
        missingFields: [],
        constraintViolations: [],
        warnings: [],
      },
      historyEvents: [{
        eventType: 'implementation_task_graph_materialized',
        taskGraphId: 'tg-1',
        payloadHash: 'h1',
      }],
    })).toBe(ImplementationTaskGraphStatus.MATERIALIZED);
  });
});
