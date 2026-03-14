export type CodexExecutionPacketStatus = 'draft' | 'validated' | 'blocked' | 'ready';

export type CodexExecutionPacketValidationState = 'valid' | 'invalid' | 'incomplete';

export type CodexExecutionPacket = {
  packetId: string;
  graphId: string;
  taskId: string;
  taskName: string;
  taskDescription: string;
  subsystem: string;
  phase: string;
  dependencies: string[];
  promptTemplate: string;
  expectedArtifacts: string[];
  validationRules: string[];
  status: CodexExecutionPacketStatus;
};

export type CodexExecutionPacketValidationResult = {
  validationState: CodexExecutionPacketValidationState;
  missingFields: string[];
  constraintViolations: string[];
  warnings: string[];
};

export type CodexExecutionPacketHistoryEventType =
  | 'codex_execution_packet_created'
  | 'codex_execution_packet_updated'
  | 'codex_execution_packet_validated'
  | 'codex_execution_packet_materialized'
  | 'codex_execution_packet_status_changed';

export type CodexExecutionPacketHistoryEvent = {
  packetId: string;
  eventType: CodexExecutionPacketHistoryEventType;
  payloadHash: string;
  payload: Record<string, unknown>;
};

export type CodexExecutionPacketProjection = {
  packetId: string;
  graphId: string;
  taskId: string;
  status: CodexExecutionPacketStatus;
  validationState: CodexExecutionPacketValidationState;
  dependencyCount: number;
  artifactCount: number;
  phase: string;
  subsystem: string;
};

export type CodexExecutionPacketInspection = {
  packet: CodexExecutionPacket;
  validation: CodexExecutionPacketValidationResult;
  projection: CodexExecutionPacketProjection;
  history: CodexExecutionPacketHistoryEvent[];
};

export type CodexExecutionPacketMaterializationSummary = {
  packetId: string;
  dirPath: string;
  packetPath: string;
  statusPath: string;
  validationPath: string;
  promptPath: string;
  reportPath: string;
};

export type CodexExecutionPacketCreateSummary = {
  graphId: string;
  packetCount: number;
  packetIds: string[];
};
