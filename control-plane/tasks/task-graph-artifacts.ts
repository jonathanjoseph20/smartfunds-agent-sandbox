import path from 'node:path';

const DEFAULT_IMPLEMENTATION_TASK_GRAPH_ARTIFACTS_ROOT = path.join('artifacts', 'tasks');

function normalizeRelativeSegment(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');

  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_TASK_GRAPH_ID: ${value}`);
  }

  return normalized;
}

export function resolveImplementationTaskGraphArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_IMPLEMENTATION_TASK_GRAPH_ARTIFACTS_ROOT);
}

export function resolveImplementationTaskGraphArtifactPaths(input: {
  taskGraphId: string;
  artifactsRoot?: string;
}) {
  const taskGraphId = normalizeRelativeSegment(input.taskGraphId);
  const dirPath = path.join(resolveImplementationTaskGraphArtifactsRoot(input.artifactsRoot), taskGraphId);

  return {
    dirPath,
    graphPath: path.join(dirPath, 'implementation-task-graph.json'),
    statusPath: path.join(dirPath, 'implementation-task-graph-status.json'),
    historyPath: path.join(dirPath, 'implementation-task-graph-history.json'),
    reportPath: path.join(dirPath, 'implementation-task-graph-report.md'),
    nodesPath: path.join(dirPath, 'implementation-task-graph-nodes.json'),
    edgesPath: path.join(dirPath, 'implementation-task-graph-edges.json'),
  };
}
