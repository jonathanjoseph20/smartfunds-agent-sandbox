import fs from 'node:fs';
import path from 'node:path';

import { getMissionTemplate } from '../templates/mission-template-registry.ts';
import { validateMissionTemplateParameters } from '../templates/mission-template-validator.ts';

import type {
  MissionProposalApprovalState,
  MissionProposalConversionState,
  MissionProposalHistoryEntry,
  MissionProposalInstance,
  MissionProposalStatus,
} from './mission-proposal-types.ts';
import { MISSION_PROPOSAL_CREATED_FROM_KINDS } from './mission-proposal-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function findConversionStateFromHistory(entries: MissionProposalHistoryEntry[]): MissionProposalConversionState {
  const eventTypes = new Set(entries.map((entry) => entry.eventType));
  if (eventTypes.has('proposal_linked_existing_mission')) {
    return 'mission_linked_existing';
  }
  if (eventTypes.has('proposal_converted_to_mission')) {
    return 'mission_created';
  }
  if (eventTypes.has('proposal_conversion_blocked')) {
    return 'conversion_blocked';
  }
  if (eventTypes.has('proposal_conversion_attempted')) {
    return 'conversion_inconclusive';
  }
  return 'not_converted';
}

function hasApprovalForConversion(approvalState: MissionProposalApprovalState): boolean {
  return approvalState === 'approved' || approvalState === 'not_required';
}

function linkedDagMissing(linkedDagId: string, missionDagDefinitionsDir?: string): boolean {
  const root = path.resolve(missionDagDefinitionsDir ?? path.join('control-plane', 'missions', 'definitions', 'mission-dags'));
  const expectedPath = path.join(root, `${linkedDagId}.json`);
  return !fs.existsSync(expectedPath);
}

export function evaluateMissionProposalStatus(input: {
  proposalInstance: MissionProposalInstance;
  historyEntries?: MissionProposalHistoryEntry[];
  missionTemplateDefinitionsDir?: string;
  missionDagDefinitionsDir?: string;
}): MissionProposalStatus {
  const proposal = input.proposalInstance;

  const blockingReasons = [...proposal.blockingReasons];
  const limitations = [...proposal.limitations];

  if (!MISSION_PROPOSAL_CREATED_FROM_KINDS.includes(proposal.createdFrom.kind)) {
    blockingReasons.push('unsupported_source_kind');
  }

  for (const linkedDagId of proposal.linkedDagIds) {
    if (linkedDagMissing(linkedDagId, input.missionDagDefinitionsDir)) {
      blockingReasons.push(`linked_dag_missing:${linkedDagId}`);
    }
  }

  if (proposal.proposedTemplateId.length > 0) {
    try {
      const template = getMissionTemplate(proposal.proposedTemplateId, {
        definitionsDir: input.missionTemplateDefinitionsDir,
      });
      validateMissionTemplateParameters(template, proposal.proposedParameters);
    } catch (error) {
      if ((error as Error).message.startsWith('Unknown mission template:')) {
        blockingReasons.push('template_missing');
      } else {
        blockingReasons.push('invalid_parameters');
      }
    }
  }

  if (proposal.proposedTemplateId.length === 0 && proposal.proposedMissionType.length === 0) {
    blockingReasons.push('conversion_target_missing');
  }

  const derivedConversionState = findConversionStateFromHistory(input.historyEntries ?? []);

  if (!hasApprovalForConversion(proposal.approvalState) && derivedConversionState !== 'not_converted') {
    blockingReasons.push('conversion_before_approval');
  }

  if (proposal.proposalState === 'draft') {
    limitations.push('proposal_not_submitted');
  }

  if (proposal.approvalState === 'pending_review') {
    limitations.push('approval_pending_review');
  }

  if (proposal.approvalState === 'rejected') {
    limitations.push('approval_rejected');
  }

  let conversionState = derivedConversionState;
  if (blockingReasons.length > 0 && conversionState === 'not_converted') {
    conversionState = 'conversion_blocked';
  }

  return {
    proposalId: proposal.proposalId,
    proposalState: proposal.proposalState,
    approvalState: proposal.approvalState,
    conversionState,
    blockingReasons: uniqueSorted(blockingReasons),
    limitations: uniqueSorted(limitations),
  };
}
