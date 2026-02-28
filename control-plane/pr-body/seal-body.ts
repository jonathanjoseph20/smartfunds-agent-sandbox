import type { TierLabel } from './types.ts';

type CanonicalEvidence = {
  'Risk Tier': string;
  'Justification': string;
  'Affected Paths': string;
  'Tests Added': string;
  'Determinism Statement': string;
};

const KEY_ORDER: Array<keyof CanonicalEvidence> = [
  'Risk Tier',
  'Justification',
  'Affected Paths',
  'Tests Added',
  'Determinism Statement'
];

export function generateCanonicalPrBody(args: { tier: TierLabel; evidence: CanonicalEvidence }): string {
  const evidenceLines = KEY_ORDER.map((key) => `${key}: ${args.evidence[key]}`);

  return [
    args.tier,
    '',
    '```evidence',
    ...evidenceLines,
    '```'
  ].join('\n');
}
