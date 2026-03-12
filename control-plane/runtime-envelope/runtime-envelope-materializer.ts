import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createRuntimeEnvelopeHistoryStore,
  ensureRuntimeEnvelopeArtifactDir,
  resolveRuntimeEnvelopeArtifactPaths,
  type RuntimeEnvelopeHistoryStore,
} from './runtime-envelope-history-store.ts';
import {
  createRuntimeEnvelopeProjection,
  type RuntimeEnvelopeProjectionEngine,
} from './runtime-envelope-projection.ts';
import type {
  MissionRuntimeEnvelopeHistory,
  MissionRuntimeEnvelopeMaterializationSummary,
} from './runtime-envelope-types.ts';

function toMarkdownReport(input: {
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  selectedTeamId: string;
  executionTarget: string;
  envelopeState: string;
  envelopeEligibility: string;
  blockers: string[];
  limitations: string[];
}): string {
  const lines = [
    '# Mission Runtime Envelope Report',
    '',
    `Runtime Envelope: ${input.runtimeEnvelopeId}`,
    `Execution Contract: ${input.executionContractId}`,
    `Mission: ${input.missionId}`,
    `Selected Team: ${input.selectedTeamId}`,
    `Execution Target: ${input.executionTarget}`,
    `Envelope State: ${input.envelopeState}`,
    `Envelope Eligibility: ${input.envelopeEligibility}`,
    '',
    '## Summary',
    `- blockers: ${input.blockers.join(', ') || 'none'}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify({
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      selectedTeamId: input.selectedTeamId,
      executionTarget: input.executionTarget,
      envelopeState: input.envelopeState,
      envelopeEligibility: input.envelopeEligibility,
      blockers: input.blockers,
      limitations: input.limitations,
    }),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function appendMaterializationEvent(input: {
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  historyStore: RuntimeEnvelopeHistoryStore;
}): MissionRuntimeEnvelopeHistory {
  input.historyStore.append({
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: 'runtime_envelope_materialized',
    reasoning: 'runtime_envelope_projection_materialized',
    payload: {
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
    },
  });

  return input.historyStore.load({
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
  });
}

export function createRuntimeEnvelopeMaterializer(options: {
  projection?: RuntimeEnvelopeProjectionEngine;
  historyStore?: RuntimeEnvelopeHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createRuntimeEnvelopeProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createRuntimeEnvelopeHistoryStore({
    artifactsRoot: options.runtimeEnvelopeArtifactsRoot,
  });

  function materializeOne(input: {
    runtimeEnvelopeId: string;
    runtimeEnvelopePolicyId?: string;
  }): MissionRuntimeEnvelopeMaterializationSummary {
    const projectedInitial = projection.projectOne(input);

    ensureRuntimeEnvelopeArtifactDir({
      runtimeEnvelopeId: projectedInitial.runtimeEnvelopeId,
      rootDir: options.runtimeEnvelopeArtifactsRoot,
    });

    const paths = resolveRuntimeEnvelopeArtifactPaths({
      runtimeEnvelopeId: projectedInitial.runtimeEnvelopeId,
      rootDir: options.runtimeEnvelopeArtifactsRoot,
    });

    const history = appendMaterializationEvent({
      runtimeEnvelopeId: projectedInitial.runtimeEnvelopeId,
      executionContractId: projectedInitial.executionContractId,
      missionId: projectedInitial.missionId,
      historyStore,
    });

    const projected = projection.projectOne(input);

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      selectedTeamId: projected.selectedTeamId,
      executionTarget: projected.executionTarget,
      envelopeState: projected.envelopeState,
      envelopeEligibility: projected.envelopeEligibility,
      blockers: projected.blockers,
      limitations: projected.limitations,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.payloadJsonPath, `${canonicalStringify(projected.runtimePayload)}\n`, 'utf8');
    fs.writeFileSync(paths.capabilitiesJsonPath, `${canonicalStringify(projected.runtimeCapabilities)}\n`, 'utf8');

    return {
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      payloadPath: paths.payloadJsonPath,
      capabilitiesPath: paths.capabilitiesJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type RuntimeEnvelopeMaterializer = ReturnType<typeof createRuntimeEnvelopeMaterializer>;
