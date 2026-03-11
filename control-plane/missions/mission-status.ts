import type { MissionInstance } from './mission-instance-types.ts';
import type {
  DeliverableDescriptor,
  MissionApprovalState,
  MissionCompletionState,
  MissionHistoryEntry,
  MissionLifecycleState,
  MissionReadinessState,
  MissionStatus,
} from './mission-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export interface MissionDeliverableDeclaration {
  deliverableId: string;
  satisfied: boolean;
}

export interface MissionStatusInput {
  missionInstance: MissionInstance;
  historyEntries?: MissionHistoryEntry[];
  linkedActionPlanStates?: Array<{ actionPlanId: string; blocked: boolean }>;
  deliverableDeclarations?: MissionDeliverableDeclaration[];
}

function summarizeDeliverables(input: {
  requestedDeliverables: DeliverableDescriptor[];
  declarations: MissionDeliverableDeclaration[];
  lifecycleState: MissionLifecycleState;
}): {
  completionState: MissionCompletionState;
  limitations: string[];
} {
  const requested = input.requestedDeliverables.map((entry) => entry.deliverableId);
  const requestedSet = new Set(requested);

  if (requested.length === 0) {
    return {
      completionState: 'not_started',
      limitations: ['no_deliverables_requested'],
    };
  }

  const normalizedDeclarations = input.declarations
    .filter((entry) => requestedSet.has(entry.deliverableId))
    .sort((left, right) => left.deliverableId.localeCompare(right.deliverableId));

  const statusByDeliverable = new Map<string, boolean>();
  for (const declaration of normalizedDeclarations) {
    if (statusByDeliverable.has(declaration.deliverableId) && statusByDeliverable.get(declaration.deliverableId) !== declaration.satisfied) {
      return {
        completionState: 'inconclusive',
        limitations: ['conflicting_deliverable_declarations'],
      };
    }
    statusByDeliverable.set(declaration.deliverableId, declaration.satisfied);
  }

  const satisfiedCount = requested
    .map((deliverableId) => statusByDeliverable.get(deliverableId) ?? false)
    .filter((entry) => entry).length;

  if (satisfiedCount === requested.length) {
    return {
      completionState: 'completed',
      limitations: [],
    };
  }

  if (input.lifecycleState === 'completed' && satisfiedCount < requested.length) {
    return {
      completionState: 'deliverables_pending',
      limitations: ['deliverables_pending'],
    };
  }

  if (satisfiedCount > 0) {
    return {
      completionState: 'in_progress',
      limitations: [],
    };
  }

  return {
    completionState: 'not_started',
    limitations: [],
  };
}

function resolveReadiness(input: {
  approvalState: MissionApprovalState;
  completionState: MissionCompletionState;
  hasObjective: boolean;
  hasDeliverables: boolean;
  blockingReasons: string[];
}): MissionReadinessState {
  if (input.completionState === 'inconclusive') {
    return 'inconclusive';
  }

  if (!input.hasObjective || !input.hasDeliverables) {
    return 'incomplete';
  }

  if (input.approvalState === 'pending_review') {
    return 'pending';
  }

  if (input.approvalState === 'rejected') {
    return 'blocked';
  }

  if (input.blockingReasons.length > 0) {
    return 'blocked';
  }

  if (input.approvalState === 'approved' || input.approvalState === 'not_required') {
    return 'ready';
  }

  return 'incomplete';
}

function evaluateLifecycle(input: {
  lifecycleState: MissionLifecycleState;
  completionState: MissionCompletionState;
  blockingReasons: string[];
}): MissionLifecycleState {
  if (input.lifecycleState === 'archived') {
    return 'archived';
  }
  if (input.lifecycleState === 'completed' || input.completionState === 'completed') {
    return 'completed';
  }
  if (input.lifecycleState === 'blocked' || input.blockingReasons.length > 0) {
    return 'blocked';
  }
  return input.lifecycleState;
}

function declarationsFromHistory(entries: MissionHistoryEntry[] = []): MissionDeliverableDeclaration[] {
  return entries
    .filter((entry) => entry.eventType === 'deliverables_declared')
    .flatMap((entry) => {
      const deliverables = (entry.payload.deliverables as unknown[] | undefined) ?? [];
      if (!Array.isArray(deliverables)) {
        return [];
      }
      return deliverables
        .filter((row): row is { deliverableId: string; satisfied: boolean } => {
          return typeof (row as { deliverableId?: unknown }).deliverableId === 'string'
            && typeof (row as { satisfied?: unknown }).satisfied === 'boolean';
        })
        .map((row) => ({
          deliverableId: row.deliverableId,
          satisfied: row.satisfied,
        }));
    })
    .sort((left, right) => left.deliverableId.localeCompare(right.deliverableId));
}

export function evaluateMissionStatus(input: MissionStatusInput): MissionStatus {
  const missionInstance = input.missionInstance;
  const hasObjective = missionInstance.objective.trim().length > 0;
  const hasDeliverables = missionInstance.requestedDeliverables.length > 0;

  const blockingReasons = [...missionInstance.blockingReasons];
  const limitations = [...missionInstance.limitations];

  if (missionInstance.approvalState === 'pending_review') {
    blockingReasons.push('approval_pending_review');
  }

  if (missionInstance.approvalState === 'rejected') {
    blockingReasons.push('approval_rejected');
  }

  if (!hasObjective) {
    limitations.push('missing_objective');
  }

  if (!hasDeliverables) {
    limitations.push('no_deliverables_requested');
  }

  for (const linked of (input.linkedActionPlanStates ?? [])) {
    if (linked.blocked) {
      blockingReasons.push(`linked_action_plan_blocked:${linked.actionPlanId}`);
    }
  }

  const declarations = input.deliverableDeclarations ?? declarationsFromHistory(input.historyEntries);
  const completion = summarizeDeliverables({
    requestedDeliverables: missionInstance.requestedDeliverables,
    declarations,
    lifecycleState: missionInstance.lifecycleState,
  });

  const normalizedBlockingReasons = uniqueSorted(blockingReasons);
  const normalizedLimitations = uniqueSorted([...limitations, ...completion.limitations]);

  const readinessState = resolveReadiness({
    approvalState: missionInstance.approvalState,
    completionState: completion.completionState,
    hasObjective,
    hasDeliverables,
    blockingReasons: normalizedBlockingReasons,
  });

  return {
    missionId: missionInstance.missionId,
    approvalState: missionInstance.approvalState,
    lifecycleState: evaluateLifecycle({
      lifecycleState: missionInstance.lifecycleState,
      completionState: completion.completionState,
      blockingReasons: normalizedBlockingReasons,
    }),
    readinessState,
    completionState: completion.completionState,
    blockingReasons: normalizedBlockingReasons,
    limitations: normalizedLimitations,
  };
}
