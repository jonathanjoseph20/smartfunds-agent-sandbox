import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createImplementationTaskGraphManager } from '../tasks/task-graph-manager.ts';
import type { ImplementationTaskGraph, ImplementationTaskGraphNode } from '../tasks/task-graph-types.ts';

import {
  deriveCodexExecutionPacketId,
  type CodexExecutionPacketIdentityPayload,
} from './codex-execution-packet-identity.ts';
import {
  createCodexExecutionPacketHistoryStore,
  type CodexExecutionPacketHistoryStore,
} from './codex-execution-packet-history-store.ts';
import { projectCodexExecutionPacket } from './codex-execution-packet-projection.ts';
import { deriveCodexExecutionPacketStatus as deriveStatus } from './codex-execution-packet-status.ts';
import type {
  CodexExecutionPacket,
  CodexExecutionPacketCreateSummary,
  CodexExecutionPacketHistoryEvent,
  CodexExecutionPacketProjection,
  CodexExecutionPacketStatus,
  CodexExecutionPacketValidationResult,
} from './codex-execution-packet-types.ts';
import { validateCodexExecutionPacket as validatePacketDefinition } from './codex-execution-packet-validation.ts';

const DEFAULT_CODEX_EXECUTION_PACKETS_FILE = path.join(
  'runtime-data',
  'codex',
  'codex-execution-packets.json',
);

type CodexExecutionPacketStore = {
  packets: CodexExecutionPacket[];
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueSorted(
    value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function parseStatus(value: unknown): CodexExecutionPacketStatus | null {
  return value === 'draft' || value === 'validated' || value === 'blocked' || value === 'ready'
    ? value
    : null;
}

function parsePacket(value: unknown): CodexExecutionPacket {
  if (!isRecord(value)) {
    throw new Error('CODEX_EXECUTION_PACKET_INVALID_PACKET');
  }

  const packetId = asString(value.packetId);
  const graphId = asString(value.graphId);
  const taskId = asString(value.taskId);
  const taskName = normalizeString(value.taskName);
  const taskDescription = normalizeString(value.taskDescription);
  const subsystem = normalizeString(value.subsystem);
  const phase = normalizeString(value.phase);
  const promptTemplate = normalizeString(value.promptTemplate);
  const status = parseStatus(value.status);

  if (!packetId || !graphId || !taskId || !status) {
    throw new Error('CODEX_EXECUTION_PACKET_INVALID_PACKET');
  }

  return {
    packetId,
    graphId,
    taskId,
    taskName,
    taskDescription,
    subsystem,
    phase,
    dependencies: normalizeStringArray(value.dependencies),
    promptTemplate,
    expectedArtifacts: normalizeStringArray(value.expectedArtifacts),
    validationRules: normalizeStringArray(value.validationRules),
    status,
  };
}

function readStore(filePath: string): CodexExecutionPacketStore {
  if (!fs.existsSync(filePath)) {
    return { packets: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('CODEX_EXECUTION_PACKET_INVALID_STORE');
  }

  const packets = Array.isArray(parsed.packets)
    ? parsed.packets.map((entry) => parsePacket(entry)).sort((left, right) => left.packetId.localeCompare(right.packetId))
    : [];

  return { packets };
}

function writeStore(filePath: string, store: CodexExecutionPacketStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify({
    packets: [...store.packets].sort((left, right) => left.packetId.localeCompare(right.packetId)),
  })}\n`, 'utf8');
}

function toPayloadHash(value: unknown): string {
  return sha256(canonicalStringify(value));
}

function normalizePhase(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'unspecified_phase';
}

function normalizeSubsystem(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'unspecified_subsystem';
}

function deriveTaskSubsystem(task: ImplementationTaskGraphNode): string {
  const taskInputs = task.taskInputs;
  if (isRecord(taskInputs) && typeof taskInputs.subsystem === 'string' && taskInputs.subsystem.trim().length > 0) {
    return normalizeSubsystem(taskInputs.subsystem);
  }

  const firstCapability = [...task.requiredCapabilities].sort((left, right) => left.localeCompare(right))[0];
  if (firstCapability) {
    return normalizeSubsystem(firstCapability);
  }

  return 'unspecified_subsystem';
}

function deriveTaskPhase(task: ImplementationTaskGraphNode): string {
  const taskInputs = task.taskInputs;
  if (isRecord(taskInputs) && typeof taskInputs.phaseName === 'string' && taskInputs.phaseName.trim().length > 0) {
    return normalizePhase(taskInputs.phaseName);
  }

  return normalizePhase(task.taskName);
}

function deriveExpectedArtifacts(input: {
  subsystem: string;
  phase: string;
  taskId: string;
}): string[] {
  return uniqueSorted([
    `implementation/${input.subsystem}/${input.phase}/${input.taskId}.patch`,
    `tests/${input.subsystem}/${input.phase}/${input.taskId}.test.patch`,
  ]);
}

function deriveValidationRules(input: {
  dependencies: string[];
}): string[] {
  const baseRules = [
    'generated_artifacts_declared',
    'typescript_compilation_required',
    'tests_required_for_behavior_changes',
  ];

  if (input.dependencies.length > 0) {
    baseRules.push('dependencies_resolved_before_execution');
  }

  return uniqueSorted(baseRules);
}

function buildPromptTemplateForTask(input: {
  graphId: string;
  task: ImplementationTaskGraphNode;
  subsystem: string;
  phase: string;
  dependencies: string[];
  expectedArtifacts: string[];
  validationRules: string[];
}): string {
  const dependencyLines = input.dependencies.length > 0
    ? input.dependencies.map((dependency) => `- ${dependency}`)
    : ['- none'];

  const artifactLines = input.expectedArtifacts.map((artifact) => `- ${artifact}`);
  const ruleLines = input.validationRules.map((rule) => `- ${rule}`);

  return [
    `# Codex Execution Packet Task ${input.task.taskNodeId}`,
    '',
    '## Implementation Objective',
    input.task.taskDescription,
    '',
    '## Task Context',
    `- graphId: ${input.graphId}`,
    `- taskId: ${input.task.taskNodeId}`,
    `- taskName: ${input.task.taskName}`,
    `- subsystem: ${input.subsystem}`,
    `- phase: ${input.phase}`,
    '',
    '## Dependency References',
    ...dependencyLines,
    '',
    '## Expected Artifacts',
    ...artifactLines,
    '',
    '## Validation Rules',
    ...ruleLines,
    '',
    '## Deterministic Constraints',
    '- Do not use randomness, timestamps, or environment-specific state.',
    '- Produce outputs only for declared expected artifacts.',
    '- Preserve deterministic ordering and stable serialization.',
    '',
  ].join('\n');
}

function deriveDependenciesForTask(graph: ImplementationTaskGraph, taskId: string): string[] {
  return graph.taskEdges
    .filter((edge) => edge.targetNodeId === taskId)
    .map((edge) => edge.sourceNodeId)
    .sort((left, right) => left.localeCompare(right));
}

function toIdentityPayload(input: {
  graphId: string;
  taskId: string;
  promptTemplate: string;
  expectedArtifacts: string[];
  validationRules: string[];
  dependencies: string[];
  subsystem: string;
  phase: string;
}): CodexExecutionPacketIdentityPayload {
  return {
    graphId: input.graphId,
    taskId: input.taskId,
    promptTemplate: input.promptTemplate,
    expectedArtifacts: uniqueSorted(input.expectedArtifacts),
    validationRules: uniqueSorted(input.validationRules),
    dependencies: uniqueSorted(input.dependencies),
    subsystem: input.subsystem,
    phase: input.phase,
  };
}

export function createCodexExecutionPacketManager(options: {
  packetsFilePath?: string;
  historyStore?: CodexExecutionPacketHistoryStore;
  historyFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
} = {}) {
  const packetsFilePath = options.packetsFilePath ?? DEFAULT_CODEX_EXECUTION_PACKETS_FILE;
  const historyStore = options.historyStore ?? createCodexExecutionPacketHistoryStore({
    historyFilePath: options.historyFilePath,
  });
  const implementationTaskGraphManager = createImplementationTaskGraphManager({
    taskGraphsFilePath: options.taskGraphsFilePath,
    historyFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function getCodexExecutionPacket(packetId: string): CodexExecutionPacket {
    const packet = readStore(packetsFilePath).packets.find((entry) => entry.packetId === packetId);
    if (!packet) {
      throw new Error(`CODEX_EXECUTION_PACKET_NOT_FOUND: ${packetId}`);
    }

    return packet;
  }

  function listCodexExecutionPackets(): CodexExecutionPacket[] {
    return readStore(packetsFilePath).packets;
  }

  function listPacketsForGraph(graphId: string): CodexExecutionPacket[] {
    return listCodexExecutionPackets()
      .filter((packet) => packet.graphId === graphId)
      .sort((left, right) => left.packetId.localeCompare(right.packetId));
  }

  function buildCodexExecutionPacketFromTask(input: {
    graph: ImplementationTaskGraph;
    task: ImplementationTaskGraphNode;
  }): {
    packet: CodexExecutionPacket;
    validation: CodexExecutionPacketValidationResult;
  } {
    const dependencies = deriveDependenciesForTask(input.graph, input.task.taskNodeId);
    const subsystem = deriveTaskSubsystem(input.task);
    const phase = deriveTaskPhase(input.task);
    const expectedArtifacts = deriveExpectedArtifacts({
      subsystem,
      phase,
      taskId: input.task.taskNodeId,
    });
    const validationRules = deriveValidationRules({ dependencies });
    const promptTemplate = buildPromptTemplateForTask({
      graphId: input.graph.taskGraphId,
      task: input.task,
      subsystem,
      phase,
      dependencies,
      expectedArtifacts,
      validationRules,
    });

    const identityPayload = toIdentityPayload({
      graphId: input.graph.taskGraphId,
      taskId: input.task.taskNodeId,
      promptTemplate,
      expectedArtifacts,
      validationRules,
      dependencies,
      subsystem,
      phase,
    });

    const packetId = deriveCodexExecutionPacketId(identityPayload);

    const packetWithoutStatus = {
      packetId,
      graphId: input.graph.taskGraphId,
      taskId: input.task.taskNodeId,
      taskName: input.task.taskName,
      taskDescription: input.task.taskDescription,
      subsystem,
      phase,
      dependencies: identityPayload.dependencies,
      promptTemplate,
      expectedArtifacts: identityPayload.expectedArtifacts,
      validationRules: identityPayload.validationRules,
    };

    const validation = validatePacketDefinition({
      packet: packetWithoutStatus,
      validTaskIds: input.graph.taskNodes.map((node) => node.taskNodeId),
    });

    const status = deriveStatus({
      packet: { dependencies: packetWithoutStatus.dependencies },
      validation,
    });

    return {
      packet: {
        ...packetWithoutStatus,
        status,
      },
      validation,
    };
  }

  function appendCodexExecutionPacketEvent(event: CodexExecutionPacketHistoryEvent) {
    return historyStore.appendCodexExecutionPacketEvent(event);
  }

  function createCodexExecutionPackets(graphId: string): CodexExecutionPacketCreateSummary {
    const graph = implementationTaskGraphManager.getImplementationTaskGraph(graphId);
    const tasks = [...graph.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId));
    const store = readStore(packetsFilePath);
    let nextPackets = [...store.packets];

    for (const task of tasks) {
      const built = buildCodexExecutionPacketFromTask({ graph, task });
      const existingIndex = nextPackets.findIndex((entry) => entry.packetId === built.packet.packetId);
      const previousStatus = existingIndex >= 0 ? nextPackets[existingIndex]!.status : null;

      if (existingIndex < 0) {
        nextPackets.push(built.packet);
        appendCodexExecutionPacketEvent({
          packetId: built.packet.packetId,
          eventType: 'codex_execution_packet_created',
          payloadHash: toPayloadHash(built.packet),
          payload: JSON.parse(canonicalStringify(built.packet)) as Record<string, unknown>,
        });
      } else {
        nextPackets[existingIndex] = built.packet;
        appendCodexExecutionPacketEvent({
          packetId: built.packet.packetId,
          eventType: 'codex_execution_packet_updated',
          payloadHash: toPayloadHash(built.packet),
          payload: JSON.parse(canonicalStringify(built.packet)) as Record<string, unknown>,
        });
      }

      appendCodexExecutionPacketEvent({
        packetId: built.packet.packetId,
        eventType: 'codex_execution_packet_validated',
        payloadHash: toPayloadHash(built.validation),
        payload: JSON.parse(canonicalStringify(built.validation)) as Record<string, unknown>,
      });

      if (previousStatus !== built.packet.status) {
        appendCodexExecutionPacketEvent({
          packetId: built.packet.packetId,
          eventType: 'codex_execution_packet_status_changed',
          payloadHash: toPayloadHash({
            status: built.packet.status,
            previousStatus,
          }),
          payload: {
            status: built.packet.status,
            ...(previousStatus ? { previousStatus } : {}),
          },
        });
      }
    }

    nextPackets = nextPackets.sort((left, right) => left.packetId.localeCompare(right.packetId));
    writeStore(packetsFilePath, { packets: nextPackets });

    const packetIds = nextPackets
      .filter((packet) => packet.graphId === graphId)
      .map((packet) => packet.packetId)
      .sort((left, right) => left.localeCompare(right));

    return {
      graphId,
      packetCount: packetIds.length,
      packetIds,
    };
  }

  function validateCodexExecutionPacket(packetId: string): CodexExecutionPacketValidationResult {
    const packet = getCodexExecutionPacket(packetId);
    const graph = implementationTaskGraphManager.getImplementationTaskGraph(packet.graphId);

    const validation = validatePacketDefinition({
      packet,
      validTaskIds: graph.taskNodes.map((node) => node.taskNodeId),
    });

    appendCodexExecutionPacketEvent({
      packetId,
      eventType: 'codex_execution_packet_validated',
      payloadHash: toPayloadHash(validation),
      payload: JSON.parse(canonicalStringify(validation)) as Record<string, unknown>,
    });

    return validation;
  }

  function deriveCodexExecutionPacketStatus(packetId: string): CodexExecutionPacketStatus {
    const packet = getCodexExecutionPacket(packetId);
    const validation = validateCodexExecutionPacket(packetId);
    const nextStatus = deriveStatus({
      packet: { dependencies: packet.dependencies },
      validation,
    });

    if (packet.status !== nextStatus) {
      const store = readStore(packetsFilePath);
      const index = store.packets.findIndex((entry) => entry.packetId === packetId);
      if (index >= 0) {
        const nextPacket: CodexExecutionPacket = {
          ...store.packets[index]!,
          status: nextStatus,
        };

        const nextPackets = [...store.packets];
        nextPackets[index] = nextPacket;
        writeStore(packetsFilePath, { packets: nextPackets });

        appendCodexExecutionPacketEvent({
          packetId,
          eventType: 'codex_execution_packet_status_changed',
          payloadHash: toPayloadHash({ previousStatus: packet.status, status: nextStatus }),
          payload: {
            previousStatus: packet.status,
            status: nextStatus,
          },
        });
      }
    }

    return nextStatus;
  }

  function deriveCodexExecutionPacketProjection(packetId: string): CodexExecutionPacketProjection {
    const packet = getCodexExecutionPacket(packetId);
    const graph = implementationTaskGraphManager.getImplementationTaskGraph(packet.graphId);
    const validation = validatePacketDefinition({
      packet,
      validTaskIds: graph.taskNodes.map((node) => node.taskNodeId),
    });
    const history = historyStore.listCodexExecutionPacketEvents(packetId);

    return projectCodexExecutionPacket({
      packet,
      validation,
      history,
    });
  }

  function listCodexExecutionPacketProjections(): CodexExecutionPacketProjection[] {
    return listCodexExecutionPackets()
      .map((packet) => deriveCodexExecutionPacketProjection(packet.packetId))
      .sort((left, right) => left.packetId.localeCompare(right.packetId));
  }

  return {
    historyStore,
    getCodexExecutionPacket,
    listCodexExecutionPackets,
    listPacketsForGraph,
    buildCodexExecutionPacketFromTask,
    buildPromptTemplateForTask,
    createCodexExecutionPackets,
    validateCodexExecutionPacket,
    deriveCodexExecutionPacketStatus,
    deriveCodexExecutionPacketProjection,
    listCodexExecutionPacketProjections,
    appendCodexExecutionPacketEvent,
  };
}

export type CodexExecutionPacketManager = ReturnType<typeof createCodexExecutionPacketManager>;
export { buildPromptTemplateForTask };
