import { describe, expect, it } from 'vitest';

import { deriveCodexExecutionPacketStatus } from '../../codex/codex-execution-packet-status.ts';

describe('codex execution packet status derivation', () => {
  it('T-PF4-S1 maps incomplete validation to draft', () => {
    expect(deriveCodexExecutionPacketStatus({
      packet: { dependencies: [] },
      validation: {
        validationState: 'incomplete',
        missingFields: ['promptTemplate'],
        constraintViolations: [],
        warnings: [],
      },
    })).toBe('draft');
  });

  it('T-PF4-S2 maps invalid validation to blocked', () => {
    expect(deriveCodexExecutionPacketStatus({
      packet: { dependencies: [] },
      validation: {
        validationState: 'invalid',
        missingFields: [],
        constraintViolations: ['invalid_dependency_reference:task-x'],
        warnings: [],
      },
    })).toBe('blocked');
  });

  it('T-PF4-S3 maps valid packet with dependencies to validated and no dependencies to ready deterministically', () => {
    const validation = {
      validationState: 'valid' as const,
      missingFields: [],
      constraintViolations: [],
      warnings: [],
    };

    expect(deriveCodexExecutionPacketStatus({ packet: { dependencies: ['task-0'] }, validation })).toBe('validated');
    expect(deriveCodexExecutionPacketStatus({ packet: { dependencies: [] }, validation })).toBe('ready');

    expect(deriveCodexExecutionPacketStatus({ packet: { dependencies: ['task-0'] }, validation })).toBe('validated');
    expect(deriveCodexExecutionPacketStatus({ packet: { dependencies: [] }, validation })).toBe('ready');
  });
});
