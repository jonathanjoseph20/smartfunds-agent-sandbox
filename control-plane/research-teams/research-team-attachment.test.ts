import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createResearchTeamAttachmentResolver } from './research-team-attachment.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-team-attachment');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('research team attachment', () => {
  it('T-RT-A1 resolves explicit cohort id and cohort type matches with deterministic rationale', () => {
    const teamDir = path.join(tmpRoot, 'teams');
    const cohortDir = path.join(tmpRoot, 'cohorts');

    writeJson(path.join(teamDir, 'team.json'), {
      teamId: 'defi-risk-team',
      displayName: 'DeFi Risk Team',
      teamType: 'risk',
      enabled: true,
      attachmentRules: {
        cohortIds: ['aave-risk'],
        cohortTypes: ['protocol-risk']
      }
    });

    writeJson(path.join(cohortDir, 'cohort.json'), {
      cohortId: 'aave-risk',
      cohortType: 'protocol-risk',
      subjectKey: 'protocol:aave',
      linkRules: {
        sharedProtocol: true,
        sharedAsset: false,
        sharedEventFamily: true,
        sharedTriggerFamily: true,
        cohortDefinitionMatch: true
      }
    });

    const resolver = createResearchTeamAttachmentResolver({
      teamDefinitionsDir: teamDir,
      cohortDefinitionsDir: cohortDir
    });

    const attachments = resolver.resolveAttachmentsForAllCohorts();
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toEqual({
      teamId: 'defi-risk-team',
      cohortId: 'aave-risk',
      attachmentReason: ['cohort_id_match:aave-risk', 'cohort_type_match:protocol-risk']
    });
  });

  it('T-RT-A2 resolves cohort type and no false attachments', () => {
    const teamDir = path.join(tmpRoot, 'teams');
    const cohortDir = path.join(tmpRoot, 'cohorts');

    writeJson(path.join(teamDir, 'team.json'), {
      teamId: 'liquidity-team',
      displayName: 'Liquidity Team',
      teamType: 'liquidity',
      enabled: true,
      attachmentRules: {
        cohortTypes: ['liquidity-monitoring']
      }
    });

    writeJson(path.join(cohortDir, 'a.json'), {
      cohortId: 'aave-liquidity',
      cohortType: 'liquidity-monitoring',
      subjectKey: 'protocol:aave',
      linkRules: {
        sharedProtocol: true,
        sharedAsset: false,
        sharedEventFamily: true,
        sharedTriggerFamily: true,
        cohortDefinitionMatch: true
      }
    });

    writeJson(path.join(cohortDir, 'b.json'), {
      cohortId: 'aave-risk',
      cohortType: 'protocol-risk',
      subjectKey: 'protocol:aave',
      linkRules: {
        sharedProtocol: true,
        sharedAsset: false,
        sharedEventFamily: true,
        sharedTriggerFamily: true,
        cohortDefinitionMatch: true
      }
    });

    const resolver = createResearchTeamAttachmentResolver({
      teamDefinitionsDir: teamDir,
      cohortDefinitionsDir: cohortDir
    });

    const attachments = resolver.resolveAttachmentsForTeam('liquidity-team');
    expect(attachments.map((entry) => entry.cohortId)).toEqual(['aave-liquidity']);
    expect(attachments[0]?.attachmentReason).toEqual(['cohort_type_match:liquidity-monitoring']);
  });
});
