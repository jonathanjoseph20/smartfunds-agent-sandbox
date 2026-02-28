export type TierLabel = 'tier-0' | 'tier-1' | 'tier-2' | 'tier-3';

export const REQUIRED_EVIDENCE_KEYS = [
  'Risk Tier',
  'Justification',
  'Affected Paths',
  'Tests Added',
  'Determinism Statement'
] as const;

export type EvidenceKey = (typeof REQUIRED_EVIDENCE_KEYS)[number];

export type ParsedEvidence = {
  tierLine: TierLabel | null;
  evidenceFound: boolean;
  evidenceStartLine: number | null;
  evidenceEndLine: number | null;
  kv: Record<string, string>;
  requiredMissing: string[];
  unsupportedKeys: string[];
  formatErrors: string[];
};

export type EvidenceValidationError = {
  code: string;
  message: string;
  details?: unknown;
};

export type EvidenceValidationResult = {
  isValid: boolean;
  errors: EvidenceValidationError[];
  warnings: string[];
};

export type CommentEvidenceScanResult = {
  detected: boolean;
  count: number;
  commentIds: number[];
};

export type ProvenanceSource = 'gh' | 'stub' | 'local' | 'unknown' | 'none';
