import type {
  DeliverableDescriptor,
  MissionApprovalState,
  MissionCompletionState,
  MissionLifecycleState,
  MissionReadinessState,
  SourceReference,
} from './mission-types.ts';

export interface MissionCreatedFrom {
  kind: string;
  referenceId?: string;
}

export interface MissionInstance {
  missionId: string;
  missionType: string;
  displayName: string;
  objective: string;
  founderInstructions: string;
  requestedDeliverables: DeliverableDescriptor[];
  sourceReferences: SourceReference[];
  linkedActionPlanIds: string[];
  linkedPortfolioIds: string[];
  linkedMarketSynthesisIds: string[];
  recommendedTeamIds: string[];
  assignedTeamIds: string[];
  approvalState: MissionApprovalState;
  lifecycleState: MissionLifecycleState;
  readinessState: MissionReadinessState;
  completionState: MissionCompletionState;
  blockingReasons: string[];
  limitations: string[];
  createdFrom: MissionCreatedFrom;
  historyDigest: string;
}
