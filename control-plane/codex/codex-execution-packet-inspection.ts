import {
  createCodexExecutionPacketManager,
  type CodexExecutionPacketManager,
} from './codex-execution-packet-manager.ts';
import {
  createCodexExecutionPacketMaterializer,
  type CodexExecutionPacketMaterializer,
} from './codex-execution-packet-materializer.ts';

export function createCodexExecutionPacketInspection(options: {
  manager?: CodexExecutionPacketManager;
  materializer?: CodexExecutionPacketMaterializer;
  packetsFilePath?: string;
  historyFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
  artifactsRoot?: string;
} = {}) {
  const manager = options.manager ?? createCodexExecutionPacketManager({
    packetsFilePath: options.packetsFilePath,
    historyFilePath: options.historyFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const materializer = options.materializer ?? createCodexExecutionPacketMaterializer({
    manager,
    artifactsRoot: options.artifactsRoot,
    packetsFilePath: options.packetsFilePath,
    historyFilePath: options.historyFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function listCodexExecutionPackets() {
    return manager.listCodexExecutionPacketProjections();
  }

  function getCodexExecutionPacket(packetId: string) {
    return manager.getCodexExecutionPacket(packetId);
  }

  function inspectCodexExecutionPacket(packetId: string) {
    const packet = manager.getCodexExecutionPacket(packetId);
    const validation = manager.validateCodexExecutionPacket(packetId);
    const projection = manager.deriveCodexExecutionPacketProjection(packetId);
    const history = manager.historyStore.listCodexExecutionPacketEvents(packetId);

    return {
      packet,
      validation,
      projection,
      history,
    };
  }

  function materializeCodexExecutionPacket(input: { packetId: string }) {
    return materializer.materializeCodexExecutionPacket(input.packetId);
  }

  return {
    listCodexExecutionPackets,
    getCodexExecutionPacket,
    inspectCodexExecutionPacket,
    materializeCodexExecutionPacket,
  };
}

export type CodexExecutionPacketInspection = ReturnType<typeof createCodexExecutionPacketInspection>;
