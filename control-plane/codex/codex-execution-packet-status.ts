import type {
  CodexExecutionPacket,
  CodexExecutionPacketStatus,
  CodexExecutionPacketValidationResult,
} from './codex-execution-packet-types.ts';

export function deriveCodexExecutionPacketStatus(input: {
  packet: Pick<CodexExecutionPacket, 'dependencies'>;
  validation: CodexExecutionPacketValidationResult;
}): CodexExecutionPacketStatus {
  if (input.validation.missingFields.length > 0 || input.validation.validationState === 'incomplete') {
    return 'draft';
  }

  if (input.validation.constraintViolations.length > 0 || input.validation.validationState === 'invalid') {
    return 'blocked';
  }

  if (input.packet.dependencies.length > 0) {
    return 'validated';
  }

  return 'ready';
}
