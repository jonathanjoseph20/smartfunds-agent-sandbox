import { EVIDENCE_FIELDS } from '../../governance/diagnostics.ts';

type CanonicalPrBodyArgs = {
  tierLabel: string;
  evidence?: Partial<Record<(typeof EVIDENCE_FIELDS)[number], string>>;
};

function tierValueFromLabel(tierLabel: string): string {
  const match = tierLabel.match(/^tier-([0-3])$/i);
  if (!match) {
    return 'N/A';
  }
  return match[1];
}

export function buildCanonicalPrBody(args: CanonicalPrBodyArgs): string {
  const evidence: Record<(typeof EVIDENCE_FIELDS)[number], string> = {
    'Risk Tier': tierValueFromLabel(args.tierLabel),
    'Justification': 'N/A',
    'Affected Paths': 'N/A',
    'Tests Added': 'N/A',
    'Determinism Statement': 'N/A'
  };

  for (const key of EVIDENCE_FIELDS) {
    const override = args.evidence?.[key];
    if (typeof override === 'string' && override.length > 0) {
      evidence[key] = override;
    }
  }

  const lines: string[] = [];
  lines.push(args.tierLabel);
  lines.push('');
  lines.push('```evidence');
  for (const key of EVIDENCE_FIELDS) {
    lines.push(`${key}: ${evidence[key]}`);
  }
  lines.push('```');
  lines.push('');
  lines.push('Auto-generated retry patch (deterministic).');
  return lines.join('\n');
}
