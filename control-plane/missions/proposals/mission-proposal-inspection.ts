import { canonicalStringify } from '../../finance/determinism.ts';

import { createMissionProposalConverter, type MissionProposalConverter } from './mission-proposal-converter.ts';
import {
  createMissionProposalHistoryStore,
  type MissionProposalHistoryStore,
} from './mission-proposal-history-store.ts';
import {
  createMissionProposalMaterializer,
  type MissionProposalMaterializer,
} from './mission-proposal-materializer.ts';
import {
  createMissionProposalProjection,
  type MissionProposalProjectionEngine,
} from './mission-proposal-projection.ts';
import {
  createMissionProposalRegistry,
  type MissionProposalRegistry,
} from './mission-proposal-registry.ts';
import { validateMissionProposalInstance } from './mission-proposal-validator.ts';
import {
  deriveMissionProposalIdFromPayload,
  type MissionProposalIdentityPayload,
} from './mission-proposal-identity.ts';
import type { MissionProposalInstance } from './mission-proposal-types.ts';

function toProposalSummary(instance: MissionProposalInstance) {
  return {
    proposalId: instance.proposalId,
    proposalType: instance.proposalType,
    displayName: instance.displayName,
    proposalState: instance.proposalState,
    approvalState: instance.approvalState,
    recommendedPriority: instance.recommendedPriority,
  };
}

function compareCanonical(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

export function createMissionProposalInspection(options: {
  registry?: MissionProposalRegistry;
  projection?: MissionProposalProjectionEngine;
  historyStore?: MissionProposalHistoryStore;
  materializer?: MissionProposalMaterializer;
  converter?: MissionProposalConverter;
  definitionsDir?: string;
  instancesDir?: string;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
  missionDagDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionProposalArtifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createMissionProposalRegistry({
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
  });

  const historyStore = options.historyStore ?? createMissionProposalHistoryStore({
    artifactsRoot: options.missionProposalArtifactsRoot,
  });

  const projection = options.projection ?? createMissionProposalProjection({
    registry,
    historyStore,
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionDagDefinitionsDir: options.missionDagDefinitionsDir,
    missionProposalArtifactsRoot: options.missionProposalArtifactsRoot,
  });

  const materializer = options.materializer ?? createMissionProposalMaterializer({
    projection,
    historyStore,
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionDagDefinitionsDir: options.missionDagDefinitionsDir,
    missionProposalArtifactsRoot: options.missionProposalArtifactsRoot,
  });

  const converter = options.converter ?? createMissionProposalConverter({
    registry,
    historyStore,
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionProposalArtifactsRoot: options.missionProposalArtifactsRoot,
  });

  function listProposals() {
    return registry.listProposalInstances()
      .map((entry) => {
        const projected = projection.projectOne(entry.proposalId);
        return {
          proposalId: entry.proposalId,
          proposalType: entry.proposalType,
          displayName: entry.displayName,
          proposalState: projected.status.proposalState,
          approvalState: projected.status.approvalState,
          conversionState: projected.status.conversionState,
          recommendedPriority: entry.recommendedPriority,
        };
      })
      .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
  }

  function inspectProposal(proposalId: string) {
    return projection.projectOne(proposalId);
  }

  function getProposalStatus(proposalId: string) {
    return projection.projectOne(proposalId).statusPreview;
  }

  function getProposalHistory(proposalId: string) {
    registry.getProposalInstance(proposalId);
    return historyStore.load(proposalId);
  }

  function materializeProposal(proposalId: string) {
    const result = materializer.materializeOne(proposalId);
    historyStore.append({
      proposalId,
      eventType: 'proposal_materialized',
      payload: {
        statusPath: result.statusPath,
        reportPath: result.reportPath,
      },
    });
    return result;
  }

  function submitProposal(payload: MissionProposalInstance): MissionProposalInstance {
    const validated = validateMissionProposalInstance(payload, '<submit>', {
      missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
      missionDefinitionsDir: options.missionDefinitionsDir,
    });

    let existing: MissionProposalInstance | null = null;
    try {
      existing = registry.getProposalInstance(validated.proposalId);
    } catch {
      existing = null;
    }

    if (existing && !compareCanonical(existing, validated)) {
      throw new Error(`MISSION_PROPOSAL_CONFLICT: ${validated.proposalId}`);
    }

    if (!existing) {
      registry.saveProposalInstance(validated);
      historyStore.append({
        proposalId: validated.proposalId,
        eventType: 'proposal_created',
        payload: {
          proposalType: validated.proposalType,
          createdByKind: validated.createdBy.kind,
          createdFromKind: validated.createdFrom.kind,
        },
      });
      historyStore.append({
        proposalId: validated.proposalId,
        eventType: 'proposal_submitted',
        payload: {
          proposalState: validated.proposalState,
          approvalState: validated.approvalState,
        },
      });
    }

    return existing ?? validated;
  }

  function submitProposalFromInput(input: Omit<MissionProposalInstance, 'proposalId'>): MissionProposalInstance {
    const proposalId = deriveMissionProposalIdFromPayload({
      proposalType: input.proposalType,
      objective: input.objective,
      summary: input.summary,
      rationale: input.rationale,
      proposedMissionType: input.proposedMissionType,
      proposedTemplateId: input.proposedTemplateId,
      proposedParameters: input.proposedParameters,
      requestedDeliverables: input.requestedDeliverables,
      sourceReferences: input.sourceReferences,
      linkedMissionIds: input.linkedMissionIds,
      linkedDagIds: input.linkedDagIds,
      linkedActionPlanIds: input.linkedActionPlanIds,
      createdBy: { kind: input.createdBy.kind },
      createdFrom: { kind: input.createdFrom.kind },
    } satisfies MissionProposalIdentityPayload);

    return submitProposal({
      ...input,
      proposalId,
    });
  }

  function reviewProposal(input: {
    proposalId: string;
    decision: 'approved' | 'rejected';
    reviewedBy: string;
    reason: string;
  }): MissionProposalInstance {
    const current = registry.getProposalInstance(input.proposalId);

    const next: MissionProposalInstance = {
      ...current,
      approvalState: input.decision === 'approved' ? 'approved' : 'rejected',
      proposalState: input.decision === 'approved' ? 'approved' : 'rejected',
    };

    registry.saveProposalInstance(next);

    historyStore.append({
      proposalId: input.proposalId,
      eventType: 'proposal_review_started',
      payload: {
        reviewedBy: input.reviewedBy,
      },
    });

    historyStore.append({
      proposalId: input.proposalId,
      eventType: input.decision === 'approved' ? 'proposal_approved' : 'proposal_rejected',
      payload: {
        reviewedBy: input.reviewedBy,
        reason: input.reason,
      },
    });

    return next;
  }

  function convertProposal(proposalId: string) {
    return converter.convertProposal(proposalId);
  }

  return {
    listProposals,
    inspectProposal,
    getProposalStatus,
    getProposalHistory,
    materializeProposal,
    submitProposal,
    submitProposalFromInput,
    reviewProposal,
    convertProposal,
    toProposalSummary,
  };
}

export type MissionProposalInspection = ReturnType<typeof createMissionProposalInspection>;
