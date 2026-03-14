import fs from 'node:fs';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  resolveCodexExecutionPacketArtifactPaths,
} from './codex-execution-packet-artifacts.ts';
import {
  createCodexExecutionPacketManager,
  type CodexExecutionPacketManager,
} from './codex-execution-packet-manager.ts';
import type {
  CodexExecutionPacketMaterializationSummary,
} from './codex-execution-packet-types.ts';

function toMarkdownReport(input: {
  packetId: string;
  graphId: string;
  taskId: string;
  taskName: string;
  subsystem: string;
  phase: string;
  status: string;
  validationState: string;
  dependencies: string[];
  expectedArtifacts: string[];
  validationRules: string[];
}): string {
  const dependencies = input.dependencies.length > 0 ? input.dependencies : ['none'];

  return [
    '# Codex Execution Packet Report',
    '',
    `- packetId: ${input.packetId}`,
    `- graphId: ${input.graphId}`,
    `- taskId: ${input.taskId}`,
    `- taskName: ${input.taskName}`,
    `- subsystem: ${input.subsystem}`,
    `- phase: ${input.phase}`,
    `- status: ${input.status}`,
    `- validationState: ${input.validationState}`,
    '',
    '## Dependencies',
    ...dependencies.map((dependency) => `- ${dependency}`),
    '',
    '## Expected Artifacts',
    ...input.expectedArtifacts.map((artifact) => `- ${artifact}`),
    '',
    '## Validation Rules',
    ...input.validationRules.map((rule) => `- ${rule}`),
    '',
  ].join('\n');
}

export function createCodexExecutionPacketMaterializer(options: {
  manager?: CodexExecutionPacketManager;
  artifactsRoot?: string;
  packetsFilePath?: string;
  historyFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
} = {}) {
  const manager = options.manager ?? createCodexExecutionPacketManager({
    packetsFilePath: options.packetsFilePath,
    historyFilePath: options.historyFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function materializeCodexExecutionPacket(packetId: string): CodexExecutionPacketMaterializationSummary {
    const packet = manager.getCodexExecutionPacket(packetId);
    const validation = manager.validateCodexExecutionPacket(packetId);
    const status = manager.deriveCodexExecutionPacketStatus(packetId);

    const paths = resolveCodexExecutionPacketArtifactPaths({
      packetId,
      artifactsRoot: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });

    fs.writeFileSync(paths.packetPath, `${canonicalStringify(packet)}\n`, 'utf8');
    fs.writeFileSync(paths.statusPath, `${canonicalStringify({
      packetId: packet.packetId,
      graphId: packet.graphId,
      taskId: packet.taskId,
      status,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.validationPath, `${canonicalStringify(validation)}\n`, 'utf8');
    fs.writeFileSync(paths.promptPath, `${packet.promptTemplate}\n`, 'utf8');
    fs.writeFileSync(paths.reportPath, toMarkdownReport({
      packetId: packet.packetId,
      graphId: packet.graphId,
      taskId: packet.taskId,
      taskName: packet.taskName,
      subsystem: packet.subsystem,
      phase: packet.phase,
      status,
      validationState: validation.validationState,
      dependencies: [...packet.dependencies].sort((left, right) => left.localeCompare(right)),
      expectedArtifacts: [...packet.expectedArtifacts].sort((left, right) => left.localeCompare(right)),
      validationRules: [...packet.validationRules].sort((left, right) => left.localeCompare(right)),
    }), 'utf8');

    manager.appendCodexExecutionPacketEvent({
      packetId: packet.packetId,
      eventType: 'codex_execution_packet_materialized',
      payloadHash: sha256(canonicalStringify({
        packetId: packet.packetId,
        dirPath: paths.dirPath,
      })),
      payload: {
        packetId: packet.packetId,
        dirPath: paths.dirPath,
      },
    });

    return {
      packetId: packet.packetId,
      dirPath: paths.dirPath,
      packetPath: paths.packetPath,
      statusPath: paths.statusPath,
      validationPath: paths.validationPath,
      promptPath: paths.promptPath,
      reportPath: paths.reportPath,
    };
  }

  return {
    materializeCodexExecutionPacket,
  };
}

export type CodexExecutionPacketMaterializer = ReturnType<typeof createCodexExecutionPacketMaterializer>;
