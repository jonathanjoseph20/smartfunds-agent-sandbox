import { canonicalStringify } from '../../finance/determinism.ts';

import type { ProgramExecutionHistory } from './program-types.ts';
import type { ProgramStatusProjection } from './program-inspection.ts';

export function toProgramReportMarkdown(input: {
  status: ProgramStatusProjection;
  history: ProgramExecutionHistory[];
}): string {
  const lines = [
    '# Cohort Program Report',
    '',
    `## Cohort ${input.status.cohortId}`,
    '',
    `cohortLifecycleState: ${input.status.cohortLifecycleState}`,
    '',
    '## Program Status',
    '',
    canonicalStringify(input.status),
    '',
    '## Program History',
    '',
    canonicalStringify(input.history),
    ''
  ];

  return `${lines.join('\n')}\n`;
}
