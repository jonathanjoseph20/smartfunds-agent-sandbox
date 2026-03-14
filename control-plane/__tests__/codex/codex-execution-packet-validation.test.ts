import { describe, expect, it } from 'vitest';

import { validateCodexExecutionPacket } from '../../codex/codex-execution-packet-validation.ts';

describe('codex execution packet validation', () => {
  it('T-PF4-V1 missing promptTemplate is incomplete', () => {
    const result = validateCodexExecutionPacket({
      packet: {
        expectedArtifacts: ['a.ts'],
        validationRules: ['rule-a'],
        dependencies: [],
      },
      validTaskIds: ['task-1'],
    });

    expect(result.validationState).toBe('incomplete');
    expect(result.missingFields).toContain('promptTemplate');
  });

  it('T-PF4-V2 empty expectedArtifacts is incomplete', () => {
    const result = validateCodexExecutionPacket({
      packet: {
        promptTemplate: 'prompt',
        expectedArtifacts: [],
        validationRules: ['rule-a'],
        dependencies: [],
      },
      validTaskIds: ['task-1'],
    });

    expect(result.validationState).toBe('incomplete');
    expect(result.missingFields).toContain('expectedArtifacts');
  });

  it('T-PF4-V3 invalid dependency reference is invalid when complete', () => {
    const result = validateCodexExecutionPacket({
      packet: {
        promptTemplate: 'prompt',
        expectedArtifacts: ['a.ts'],
        validationRules: ['rule-a'],
        dependencies: ['task-missing'],
      },
      validTaskIds: ['task-1'],
    });

    expect(result.validationState).toBe('invalid');
    expect(result.constraintViolations).toEqual(['invalid_dependency_reference:task-missing']);
  });

  it('T-PF4-V4 missing validationRules is incomplete', () => {
    const result = validateCodexExecutionPacket({
      packet: {
        promptTemplate: 'prompt',
        expectedArtifacts: ['a.ts'],
        dependencies: [],
      },
      validTaskIds: ['task-1'],
    });

    expect(result.validationState).toBe('incomplete');
    expect(result.missingFields).toContain('validationRules');
  });
});
