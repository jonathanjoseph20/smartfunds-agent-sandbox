import { describe, expect, it } from 'vitest';

import { loadMissionDefinitionsFromDir } from './mission-loader.ts';
import { loadWorkflowDefinitionById } from '../workflows/workflow-loader.ts';

describe('mission to workflow consistency', () => {
  it('T-M85-1 every mission definition references an existing workflow definition', () => {
    const missions = loadMissionDefinitionsFromDir();
    const missing: string[] = [];

    for (const mission of missions) {
      try {
        loadWorkflowDefinitionById(mission.workflowId);
      } catch {
        missing.push(`${mission.missionId}->${mission.workflowId}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('T-M85-2 canonical demo mission maps to research-analysis-workflow', () => {
    const missions = loadMissionDefinitionsFromDir();
    const canonical = missions.find((mission) => mission.missionId === 'rwa-market-analysis');

    expect(canonical).toBeDefined();
    expect(canonical?.workflowId).toBe('research-analysis-workflow');
  });
});

