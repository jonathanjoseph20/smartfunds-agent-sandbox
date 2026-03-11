import type { SwarmReadiness } from './swarm-types.ts';

interface ReadinessInvestigation {
  investigationDefinitionId: string;
  status: string;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluateSwarmReadiness(input: {
  swarmId: string;
  expectedInvestigationTemplates: string[];
  investigations: ReadinessInvestigation[];
  synthesisReadinessStates: string[];
  unresolvedConflictCount: number;
}): SwarmReadiness {
  const expectedInvestigationTemplates = uniqueSorted(input.expectedInvestigationTemplates);
  const investigations = [...input.investigations].sort((left, right) => left.investigationDefinitionId.localeCompare(right.investigationDefinitionId));
  const synthesisReadinessStates = uniqueSorted(input.synthesisReadinessStates);

  const linkedTemplateIds = uniqueSorted(investigations.map((entry) => entry.investigationDefinitionId));
  const missingTemplateIds = expectedInvestigationTemplates.filter((templateId) => !linkedTemplateIds.includes(templateId));

  const activeInvestigationCount = investigations
    .filter((entry) => ['running', 'pending', 'awaiting_data', 'scheduled_resume', 'retry_pending'].includes(entry.status))
    .length;

  const synthesisReadyCount = synthesisReadinessStates
    .filter((state) => state === 'ready' || state === 'completed')
    .length;

  const blockingReasons: string[] = [];
  const strengths: string[] = [];
  const limitations: string[] = [];

  if (input.unresolvedConflictCount > 0) {
    blockingReasons.push('unresolved_conflicts_present');
    limitations.push(`unresolved conflicts: ${String(input.unresolvedConflictCount)}`);
  }

  if (missingTemplateIds.length > 0) {
    limitations.push(`missing investigation templates: ${missingTemplateIds.join(', ')}`);
  } else if (expectedInvestigationTemplates.length > 0) {
    strengths.push('investigation template coverage complete');
  }

  if (synthesisReadyCount > 0) {
    strengths.push(`synthesis ready count: ${String(synthesisReadyCount)}`);
  }

  let readiness: SwarmReadiness['readiness'];
  if (input.unresolvedConflictCount > 0) {
    readiness = 'blocked';
  } else if (synthesisReadyCount > 0 && missingTemplateIds.length === 0) {
    readiness = 'coherent';
  } else if (activeInvestigationCount > 0 || investigations.length > 0) {
    readiness = 'analyzing';
  } else {
    readiness = 'pending';
  }

  return {
    swarmId: input.swarmId,
    readiness,
    blockingReasons: uniqueSorted(blockingReasons),
    strengths: uniqueSorted(strengths),
    limitations: uniqueSorted(limitations),
    expectedInvestigationCount: expectedInvestigationTemplates.length,
    linkedInvestigationCount: investigations.length,
    synthesisReadyCount,
    unresolvedConflictCount: input.unresolvedConflictCount
  };
}
