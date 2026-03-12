import {
  deriveMissionIdFromPayload,
  normalizeMissionIdentityPayload,
  type MissionIdentityPayload,
} from '../mission-identity.ts';
import type { MissionInstance } from '../mission-instance-types.ts';
import {
  loadMissionInstances,
  validateMissionInstance,
  writeMissionInstance,
} from '../mission-registry.ts';
import type { DeliverableDescriptor } from '../mission-types.ts';
import { instantiateMissionTemplate } from '../templates/mission-template-engine.ts';

import {
  createMissionProposalHistoryStore,
  type MissionProposalHistoryStore,
} from './mission-proposal-history-store.ts';
import type { MissionProposalRegistry } from './mission-proposal-registry.ts';
import { createMissionProposalRegistry } from './mission-proposal-registry.ts';
import type {
  MissionProposalConversionResult,
  MissionProposalInstance,
} from './mission-proposal-types.ts';

function toMissionDeliverables(deliverables: DeliverableDescriptor[]): DeliverableDescriptor[] {
  return deliverables
    .map((entry) => ({
      deliverableId: entry.deliverableId,
      ...(entry.description ? { description: entry.description } : {}),
      ...(entry.satisfied === undefined ? {} : { satisfied: entry.satisfied }),
    }))
    .sort((left, right) => left.deliverableId.localeCompare(right.deliverableId));
}

function buildMissionIdentityPayloadFromProposal(input: {
  proposal: MissionProposalInstance;
  missionType: string;
  objective: string;
  requestedDeliverables: DeliverableDescriptor[];
  founderInstructions: string;
  createdFromKind: string;
}): MissionIdentityPayload {
  return normalizeMissionIdentityPayload({
    missionType: input.missionType,
    objective: input.objective,
    requestedDeliverables: input.requestedDeliverables,
    sourceReferences: input.proposal.sourceReferences,
    linkedActionPlanIds: input.proposal.linkedActionPlanIds,
    founderInstructions: input.founderInstructions,
    createdFrom: {
      kind: input.createdFromKind,
    },
  });
}

function createMissionInstanceFromTemplate(input: {
  proposal: MissionProposalInstance;
  missionTemplateDefinitionsDir?: string;
}): MissionInstance {
  const instantiated = instantiateMissionTemplate(
    input.proposal.proposedTemplateId,
    input.proposal.proposedParameters,
    input.proposal.proposedFounderInstructions,
    { definitionsDir: input.missionTemplateDefinitionsDir },
  );

  const createdFromKind = 'proposal_template';
  const identityPayload = buildMissionIdentityPayloadFromProposal({
    proposal: input.proposal,
    missionType: instantiated.missionInstance.missionType,
    objective: instantiated.missionInstance.objective,
    requestedDeliverables: instantiated.missionInstance.requestedDeliverables,
    founderInstructions: input.proposal.proposedFounderInstructions,
    createdFromKind,
  });

  const missionId = deriveMissionIdFromPayload(identityPayload);

  return {
    ...instantiated.missionInstance,
    missionId,
    requestedDeliverables: toMissionDeliverables(instantiated.missionInstance.requestedDeliverables),
    sourceReferences: [...input.proposal.sourceReferences],
    linkedActionPlanIds: [...input.proposal.linkedActionPlanIds],
    linkedPortfolioIds: [...input.proposal.linkedPortfolioIds],
    linkedMarketSynthesisIds: [],
    createdFrom: {
      kind: createdFromKind,
      referenceId: input.proposal.proposalId,
    },
  };
}

function createMissionInstanceFromExplicitProposal(input: {
  proposal: MissionProposalInstance;
}): MissionInstance {
  const createdFromKind = 'proposal_explicit';

  const requestedDeliverables = input.proposal.requestedDeliverables.length > 0
    ? toMissionDeliverables(input.proposal.requestedDeliverables)
    : [{ deliverableId: 'proposal-deliverable' }];

  const identityPayload = buildMissionIdentityPayloadFromProposal({
    proposal: input.proposal,
    missionType: input.proposal.proposedMissionType,
    objective: input.proposal.objective,
    requestedDeliverables,
    founderInstructions: input.proposal.proposedFounderInstructions,
    createdFromKind,
  });

  const missionId = deriveMissionIdFromPayload(identityPayload);

  return {
    missionId,
    missionType: input.proposal.proposedMissionType,
    displayName: input.proposal.displayName,
    objective: input.proposal.objective,
    founderInstructions: input.proposal.proposedFounderInstructions,
    requestedDeliverables,
    sourceReferences: [...input.proposal.sourceReferences],
    linkedActionPlanIds: [...input.proposal.linkedActionPlanIds],
    linkedPortfolioIds: [...input.proposal.linkedPortfolioIds],
    linkedMarketSynthesisIds: [],
    recommendedTeamIds: [],
    assignedTeamIds: [],
    approvalState: 'pending_review',
    lifecycleState: 'draft',
    readinessState: 'pending',
    completionState: 'not_started',
    blockingReasons: [],
    limitations: [],
    createdFrom: {
      kind: createdFromKind,
      referenceId: input.proposal.proposalId,
    },
    historyDigest: '',
  };
}

function findExistingMission(missionId: string, missionInstancesDir?: string): MissionInstance | null {
  const instances = loadMissionInstances({ instancesDir: missionInstancesDir });
  return instances.find((entry) => entry.missionId === missionId) ?? null;
}

export function createMissionProposalConverter(options: {
  registry?: MissionProposalRegistry;
  historyStore?: MissionProposalHistoryStore;
  definitionsDir?: string;
  instancesDir?: string;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
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

  function convertProposal(proposalId: string): MissionProposalConversionResult {
    const proposal = registry.getProposalInstance(proposalId);

    historyStore.append({
      proposalId,
      eventType: 'proposal_conversion_attempted',
      payload: {
        approvalState: proposal.approvalState,
        proposalState: proposal.proposalState,
      },
    });

    if (!(proposal.approvalState === 'approved' || proposal.approvalState === 'not_required')) {
      historyStore.append({
        proposalId,
        eventType: 'proposal_conversion_blocked',
        payload: {
          reason: 'conversion_before_approval',
        },
      });
      return {
        proposalId,
        conversionState: 'conversion_blocked',
        linkedExistingMission: false,
        reason: 'conversion_before_approval',
      };
    }

    if (proposal.proposedTemplateId.length === 0 && proposal.proposedMissionType.length === 0) {
      historyStore.append({
        proposalId,
        eventType: 'proposal_conversion_blocked',
        payload: {
          reason: 'conversion_target_missing',
        },
      });
      return {
        proposalId,
        conversionState: 'conversion_blocked',
        linkedExistingMission: false,
        reason: 'conversion_target_missing',
      };
    }

    const missionInstance = proposal.proposedTemplateId.length > 0
      ? createMissionInstanceFromTemplate({
        proposal,
        missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
      })
      : createMissionInstanceFromExplicitProposal({ proposal });

    const validatedMission = validateMissionInstance(missionInstance, '<proposal-conversion>');
    const existing = findExistingMission(validatedMission.missionId, options.missionInstancesDir);

    if (existing) {
      historyStore.append({
        proposalId,
        eventType: 'proposal_linked_existing_mission',
        payload: {
          missionId: existing.missionId,
        },
      });
      return {
        proposalId,
        conversionState: 'mission_linked_existing',
        missionId: existing.missionId,
        linkedExistingMission: true,
        reason: 'linked_existing_mission',
      };
    }

    writeMissionInstance(validatedMission, { instancesDir: options.missionInstancesDir });

    historyStore.append({
      proposalId,
      eventType: 'proposal_converted_to_mission',
      payload: {
        missionId: validatedMission.missionId,
      },
    });

    return {
      proposalId,
      conversionState: 'mission_created',
      missionId: validatedMission.missionId,
      linkedExistingMission: false,
      reason: 'mission_created_from_proposal',
    };
  }

  return {
    convertProposal,
  };
}

export type MissionProposalConverter = ReturnType<typeof createMissionProposalConverter>;
