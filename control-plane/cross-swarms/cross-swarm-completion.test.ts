import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';

import { evaluateCrossSwarmCompletion } from './cross-swarm-completion.ts';

describe('cross-swarm completion', () => {
  it('T-CS-C1 marks complete when deterministic criteria are satisfied', () => {
    const completion = evaluateCrossSwarmCompletion({
      definition: {
        crossSwarmId: 'x',
        displayName: 'X',
        groupType: 'protocol_response_cluster',
        enabled: true,
        scope: { teamIds: [], subjectKeys: [] },
        include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
        requiredMatchDimensions: ['explicit_definition_match'],
        completionRules: {
          requireAllLinkedSwarmsComplete: true,
          requireNoBlockedSwarms: true,
          requireNoUnresolvedConflicts: true,
          requireCoherentReadiness: true
        }
      },
      linkedSwarms: [{
        crossSwarmId: 'x',
        swarmId: 'a',
        teamId: 'defi-risk-team',
        swarmDisplayName: 'A',
        lifecycleState: 'completed',
        readinessState: 'coherent',
        completionSatisfied: true,
        unresolvedConflictCount: 0,
        activeInvestigationCount: 0,
        linkedInvestigationIds: [],
        linkedSynthesisIds: [],
        protocolFamilies: [],
        assetFamilies: [],
        eventFamilies: [],
        cohortFamilies: [],
        rationale: []
      }],
      readinessState: 'coherent'
    });

    expect(completion.isComplete).toBe(true);
    expect(completion.unmetRequirements).toEqual([]);
  });

  it('T-CS-C2 remains incomplete when blocked swarm remains', () => {
    const completion = evaluateCrossSwarmCompletion({
      definition: {
        crossSwarmId: 'x',
        displayName: 'X',
        groupType: 'protocol_response_cluster',
        enabled: true,
        scope: { teamIds: [], subjectKeys: [] },
        include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
        requiredMatchDimensions: ['explicit_definition_match'],
        completionRules: {
          requireAllLinkedSwarmsComplete: true,
          requireNoBlockedSwarms: true,
          requireNoUnresolvedConflicts: true,
          requireCoherentReadiness: true
        }
      },
      linkedSwarms: [{
        crossSwarmId: 'x',
        swarmId: 'a',
        teamId: 'defi-risk-team',
        swarmDisplayName: 'A',
        lifecycleState: 'stabilizing',
        readinessState: 'blocked',
        completionSatisfied: false,
        unresolvedConflictCount: 1,
        activeInvestigationCount: 1,
        linkedInvestigationIds: ['inv-1'],
        linkedSynthesisIds: [],
        protocolFamilies: [],
        assetFamilies: [],
        eventFamilies: [],
        cohortFamilies: [],
        rationale: []
      }],
      readinessState: 'blocked'
    });

    expect(completion.isComplete).toBe(false);
    expect(completion.unmetRequirements).toContain('blocked_swarms:1');
  });

  it('T-CS-C3 yields deterministic serialized completion payload', () => {
    const completion = evaluateCrossSwarmCompletion({
      definition: {
        crossSwarmId: 'x',
        displayName: 'X',
        groupType: 'protocol_response_cluster',
        enabled: true,
        scope: { teamIds: [], subjectKeys: [] },
        include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
        requiredMatchDimensions: ['explicit_definition_match'],
        completionRules: {
          requireAllLinkedSwarmsComplete: false,
          requireNoBlockedSwarms: false,
          requireNoUnresolvedConflicts: false,
          requireCoherentReadiness: false
        }
      },
      linkedSwarms: [{
        crossSwarmId: 'x',
        swarmId: 'a',
        teamId: 'defi-risk-team',
        swarmDisplayName: 'A',
        lifecycleState: 'active',
        readinessState: 'analyzing',
        completionSatisfied: false,
        unresolvedConflictCount: 0,
        activeInvestigationCount: 1,
        linkedInvestigationIds: ['inv-1'],
        linkedSynthesisIds: [],
        protocolFamilies: [],
        assetFamilies: [],
        eventFamilies: [],
        cohortFamilies: [],
        rationale: []
      }],
      readinessState: 'analyzing'
    });

    expect(canonicalStringify(completion)).toBe(canonicalStringify(completion));
  });
});
