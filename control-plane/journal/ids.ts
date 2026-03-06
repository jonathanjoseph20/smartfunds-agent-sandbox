function padCounter(value: number): string {
  return String(value).padStart(4, '0');
}

export function createRunId(projectId: string, counter: number): string {
  return `run_${projectId}_${padCounter(counter)}`;
}

export function createEventId(runId: string, sequence: number): string {
  return `evt_${runId}_${padCounter(sequence)}`;
}

export function createArtifactId(runId: string, sequence: number): string {
  return `art_${runId}_${padCounter(sequence)}`;
}

export function parseRunCounter(runId: string, projectId: string): number | null {
  const prefix = `run_${projectId}_`;
  if (!runId.startsWith(prefix)) {
    return null;
  }

  const suffix = runId.slice(prefix.length);
  if (!/^[0-9]{4}$/.test(suffix)) {
    return null;
  }

  return Number.parseInt(suffix, 10);
}
