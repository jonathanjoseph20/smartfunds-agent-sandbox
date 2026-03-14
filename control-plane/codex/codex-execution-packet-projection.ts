import type {
  CodexExecutionPacket,
  CodexExecutionPacketHistoryEvent,
  CodexExecutionPacketProjection,
  CodexExecutionPacketValidationResult,
} from './codex-execution-packet-types.ts';

export function projectCodexExecutionPacket(input: {
  packet: CodexExecutionPacket;
  validation: CodexExecutionPacketValidationResult;
  history: CodexExecutionPacketHistoryEvent[];
}): CodexExecutionPacketProjection {
  const dependencies = [...input.packet.dependencies].sort((left, right) => left.localeCompare(right));
  const expectedArtifacts = [...input.packet.expectedArtifacts].sort((left, right) => left.localeCompare(right));

  return {
    packetId: input.packet.packetId,
    graphId: input.packet.graphId,
    taskId: input.packet.taskId,
    status: input.packet.status,
    validationState: input.validation.validationState,
    dependencyCount: dependencies.length,
    artifactCount: expectedArtifacts.length,
    phase: input.packet.phase,
    subsystem: input.packet.subsystem,
  };
}

export function projectCodexExecutionPackets(input: {
  packets: CodexExecutionPacket[];
  getValidation: (packetId: string) => CodexExecutionPacketValidationResult;
  getHistory: (packetId: string) => CodexExecutionPacketHistoryEvent[];
}): CodexExecutionPacketProjection[] {
  return [...input.packets]
    .sort((left, right) => left.packetId.localeCompare(right.packetId))
    .map((packet) => projectCodexExecutionPacket({
      packet,
      validation: input.getValidation(packet.packetId),
      history: input.getHistory(packet.packetId),
    }))
    .sort((left, right) => left.packetId.localeCompare(right.packetId));
}
