import path from 'node:path';

const DEFAULT_CODEX_EXECUTION_PACKET_ARTIFACTS_ROOT = path.join('artifacts', 'codex');

function normalizeRelativeSegment(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');

  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_CODEX_EXECUTION_PACKET_ID: ${value}`);
  }

  return normalized;
}

export function resolveCodexExecutionPacketArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_CODEX_EXECUTION_PACKET_ARTIFACTS_ROOT);
}

export function resolveCodexExecutionPacketArtifactPaths(input: {
  packetId: string;
  artifactsRoot?: string;
}) {
  const packetId = normalizeRelativeSegment(input.packetId);
  const dirPath = path.join(resolveCodexExecutionPacketArtifactsRoot(input.artifactsRoot), packetId);

  return {
    dirPath,
    packetPath: path.join(dirPath, 'codex-execution-packet.json'),
    statusPath: path.join(dirPath, 'codex-execution-packet-status.json'),
    validationPath: path.join(dirPath, 'codex-execution-packet-validation.json'),
    promptPath: path.join(dirPath, 'codex-execution-packet-prompt.txt'),
    reportPath: path.join(dirPath, 'codex-execution-packet-report.md'),
  };
}
