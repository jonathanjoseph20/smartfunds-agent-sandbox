import fs from 'node:fs';
import path from 'node:path';

import { createMissionService } from '../../control-plane/operator/mission-service.ts';
import { createWorkflowService } from '../../control-plane/operator/workflow-service.ts';
import { listArtifactsForRun } from '../output/artifact-listing.ts';

export type MissionControllerOptions = {
  rootDir?: string;
  artifactsDir?: string;
  missionService?: ReturnType<typeof createMissionService>;
  workflowService?: ReturnType<typeof createWorkflowService>;
  onMissionCompleted?: (input: { missionId: string; runId: string; artifacts: string[] }) => Promise<void> | void;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function listArtifactFiles(rootDir: string, missionId: string): string[] {
  const missionRoot = path.join(rootDir, missionId);
  if (!fs.existsSync(missionRoot)) {
    return [];
  }

  const files: string[] = [];
  const stack = [missionRoot];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      files.push(absolute);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export function createMissionController(options: MissionControllerOptions = {}) {
  const missionService = options.missionService ?? createMissionService({ rootDir: options.rootDir });
  const workflowService = options.workflowService ?? createWorkflowService({ rootDir: options.rootDir });
  const artifactsDir = options.artifactsDir ?? path.join('.', 'artifacts');

  async function startMission(missionName: string): Promise<Record<string, unknown>> {
    const started = asRecord(await missionService.startMission({ missionId: missionName, params: {} }));
    const runId = asString(started.workflowRun);
    const missionId = asString(started.missionId) ?? missionName;
    if (options.onMissionCompleted && runId) {
      const artifacts = listArtifactsForRun({
        missionId,
        runId,
        artifactsRoot: artifactsDir
      });
      await options.onMissionCompleted({ missionId, runId, artifacts });
    }

    return started;
  }

  function getStatus(missionId: string): Record<string, unknown> {
    const status = asRecord(missionService.inspectMission({ missionId }));

    const workflowRuns = Array.isArray(status.workflowRuns)
      ? status.workflowRuns.filter((entry) => entry && typeof entry === 'object') as Array<Record<string, unknown>>
      : [];

    const latestRun = [...workflowRuns].sort((left, right) => {
      const leftRunId = asString(left.runId) ?? '';
      const rightRunId = asString(right.runId) ?? '';
      return leftRunId.localeCompare(rightRunId);
    }).at(-1);

    return {
      missionId: asString(status.missionId) ?? missionId,
      status: asString(status.status) ?? 'created',
      teamId: asString(status.teamId),
      workflowId: asString(status.workflowId),
      runId: latestRun ? asString(latestRun.runId) : null,
      nodeStates: Array.isArray(status.nodeStates) ? status.nodeStates : []
    };
  }

  function cancelMission(missionId: string): Record<string, unknown> {
    return asRecord(missionService.cancelMission({ missionId }));
  }

  function getLogs(missionId: string): Record<string, unknown> {
    const status = asRecord(missionService.inspectMission({ missionId }));
    const workflowRuns = Array.isArray(status.workflowRuns)
      ? status.workflowRuns.filter((entry) => entry && typeof entry === 'object') as Array<Record<string, unknown>>
      : [];

    const latestRun = [...workflowRuns].sort((left, right) => {
      const leftRunId = asString(left.runId) ?? '';
      const rightRunId = asString(right.runId) ?? '';
      return leftRunId.localeCompare(rightRunId);
    }).at(-1);

    const runId = latestRun ? asString(latestRun.runId) : null;
    if (!runId) {
      throw new Error(`MISSION_RUN_NOT_FOUND: ${missionId}`);
    }

    return asRecord(workflowService.traceWorkflow({ runId }));
  }

  function getArtifacts(missionId: string): Record<string, unknown> {
    return {
      missionId,
      artifacts: listArtifactFiles(artifactsDir, missionId)
    };
  }

  function getRunStatus(runId: string): Record<string, unknown> {
    const status = asRecord(workflowService.inspectWorkflow({ runId }));
    const summary = asRecord(status.summary);

    return {
      runId,
      missionId: asString(status.missionId),
      status: asString(status.status) ?? 'unknown',
      phase: asString(summary.activeNodeId)
    };
  }

  function getArtifactsByRun(runId: string): Record<string, unknown> {
    const status = asRecord(workflowService.inspectWorkflow({ runId }));
    const missionId = asString(status.missionId);
    if (!missionId) {
      throw new Error(`MISSION_NOT_FOUND_FOR_RUN: ${runId}`);
    }

    return {
      missionId,
      runId,
      artifacts: listArtifactsForRun({
        missionId,
        runId,
        artifactsRoot: artifactsDir
      })
    };
  }

  return {
    startMission,
    getStatus,
    cancelMission,
    getLogs,
    getArtifacts,
    getRunStatus,
    getArtifactsByRun
  };
}

export type MissionController = ReturnType<typeof createMissionController>;
