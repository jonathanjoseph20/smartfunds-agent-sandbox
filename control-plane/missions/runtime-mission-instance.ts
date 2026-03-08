import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import {
  RUNTIME_MISSION_PHASES,
  type MissionTemplateDefinition,
  type RuntimeMissionPhase,
  type RuntimeMissionRecord,
  type RuntimeMissionState,
  type RuntimeMissionStatus
} from './mission-control-types.ts';

const DEFAULT_RUNTIME_MISSIONS_DIR = 'runtime/missions';
const STATUS_FILE = 'status.json';
const MISSION_FILE = 'mission.yaml';

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sortedDirs(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath)
    .sort((left, right) => left.localeCompare(right))
    .filter((entry) => fs.statSync(path.join(dirPath, entry)).isDirectory());
}

function formatMissionId(index: number): string {
  return `mission-${String(index).padStart(3, '0')}`;
}

function nextMissionId(rootDir: string): string {
  const ids = sortedDirs(rootDir)
    .map((entry) => {
      const match = entry.match(/^mission-(\d+)$/);
      return match ? Number.parseInt(match[1], 10) : 0;
    })
    .filter((value) => Number.isFinite(value));

  const maxValue = ids.length > 0 ? Math.max(...ids) : 0;
  return formatMissionId(maxValue + 1);
}

function toMissionYaml(template: MissionTemplateDefinition, missionId: string): string {
  const lines = [
    `missionId: ${missionId}`,
    `template: ${template.missionId}`,
    `title: ${template.title}`,
    `missionType: ${template.missionType}`,
    `projectId: ${template.projectId}`,
    `workflowId: ${template.workflowId}`,
    `teamId: ${template.teamId}`,
    'deliverables:'
  ];

  for (const deliverable of template.deliverables) {
    lines.push(`  - ${deliverable}`);
  }

  return `${lines.join('\n')}\n`;
}

function writeStatus(rootDir: string, status: RuntimeMissionState): void {
  fs.writeFileSync(path.join(rootDir, STATUS_FILE), `${canonicalStringify(status)}\n`, 'utf8');
}

function readStatus(rootDir: string): RuntimeMissionState {
  const filePath = path.join(rootDir, STATUS_FILE);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as RuntimeMissionState;
}

function assertSequentialPhase(current: RuntimeMissionPhase, next: RuntimeMissionPhase): void {
  const currentIndex = RUNTIME_MISSION_PHASES.indexOf(current);
  const nextIndex = RUNTIME_MISSION_PHASES.indexOf(next);
  if (nextIndex !== currentIndex + 1) {
    throw new Error(`Mission phase transition invalid: ${current} -> ${next}.`);
  }
}

function updateStatus(rootDir: string, input: {
  phase: RuntimeMissionPhase;
  status: RuntimeMissionStatus;
}): RuntimeMissionState {
  const current = readStatus(rootDir);
  assertSequentialPhase(current.phase, input.phase);

  const updated: RuntimeMissionState = {
    missionId: current.missionId,
    template: current.template,
    teamId: current.teamId,
    status: input.status,
    phase: input.phase
  };

  writeStatus(rootDir, updated);
  return updated;
}

function missionRoot(rootDir: string, missionId: string): string {
  return path.join(rootDir, missionId);
}

export function createRuntimeMissionInstance(input: {
  template: MissionTemplateDefinition;
  rootDir?: string;
}): RuntimeMissionRecord {
  const rootDir = input.rootDir ?? DEFAULT_RUNTIME_MISSIONS_DIR;
  ensureDir(rootDir);

  const missionId = nextMissionId(rootDir);
  const missionRootDir = missionRoot(rootDir, missionId);
  const artifactsDir = path.join(missionRootDir, 'artifacts');
  const logsDir = path.join(missionRootDir, 'logs');

  ensureDir(missionRootDir);
  ensureDir(artifactsDir);
  ensureDir(logsDir);

  fs.writeFileSync(path.join(missionRootDir, MISSION_FILE), toMissionYaml(input.template, missionId), 'utf8');

  const status: RuntimeMissionState = {
    missionId,
    template: input.template.missionId,
    teamId: input.template.teamId,
    status: 'created',
    phase: 'init'
  };

  writeStatus(missionRootDir, status);

  return {
    missionId,
    template: input.template,
    status,
    rootDir: missionRootDir,
    artifactsDir,
    logsDir
  };
}

export function getRuntimeMissionRecord(input: {
  missionId: string;
  templates: MissionTemplateDefinition[];
  rootDir?: string;
}): RuntimeMissionRecord {
  const rootDir = input.rootDir ?? DEFAULT_RUNTIME_MISSIONS_DIR;
  const missionRootDir = missionRoot(rootDir, input.missionId);
  if (!fs.existsSync(missionRootDir)) {
    throw new Error(`Runtime mission not found: ${input.missionId}`);
  }

  const status = readStatus(missionRootDir);
  const template = input.templates.find((entry) => entry.missionId === status.template);
  if (!template) {
    throw new Error(`Runtime mission ${input.missionId} references unknown template ${status.template}.`);
  }

  return {
    missionId: input.missionId,
    template,
    status,
    rootDir: missionRootDir,
    artifactsDir: path.join(missionRootDir, 'artifacts'),
    logsDir: path.join(missionRootDir, 'logs')
  };
}

export function listRuntimeMissionRecords(input: {
  templates: MissionTemplateDefinition[];
  rootDir?: string;
}): RuntimeMissionRecord[] {
  const rootDir = input.rootDir ?? DEFAULT_RUNTIME_MISSIONS_DIR;
  return sortedDirs(rootDir)
    .filter((entry) => /^mission-\d+$/.test(entry))
    .map((missionId) => getRuntimeMissionRecord({ missionId, templates: input.templates, rootDir }));
}

export function advanceRuntimeMissionPhase(input: {
  missionId: string;
  nextPhase: RuntimeMissionPhase;
  nextStatus: RuntimeMissionStatus;
  rootDir?: string;
}): RuntimeMissionState {
  const rootDir = input.rootDir ?? DEFAULT_RUNTIME_MISSIONS_DIR;
  const missionRootDir = missionRoot(rootDir, input.missionId);
  if (!fs.existsSync(missionRootDir)) {
    throw new Error(`Runtime mission not found: ${input.missionId}`);
  }
  return updateStatus(missionRootDir, {
    phase: input.nextPhase,
    status: input.nextStatus
  });
}

export function setRuntimeMissionResult(input: {
  missionId: string;
  status: 'completed' | 'failed';
  rootDir?: string;
}): RuntimeMissionState {
  const rootDir = input.rootDir ?? DEFAULT_RUNTIME_MISSIONS_DIR;
  const missionRootDir = missionRoot(rootDir, input.missionId);
  const current = readStatus(missionRootDir);

  const updated: RuntimeMissionState = {
    missionId: current.missionId,
    template: current.template,
    teamId: current.teamId,
    status: input.status,
    phase: current.phase
  };

  writeStatus(missionRootDir, updated);
  return updated;
}
