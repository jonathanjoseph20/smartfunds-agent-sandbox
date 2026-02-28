import {
  GOVERNANCE_JSON_END_MARKER,
  GOVERNANCE_JSON_START_MARKER,
  type GovernanceErrorJson,
  type GovernanceExtraction,
  type NormalizedCheck,
  type RawCheck
} from './types.ts';

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim();
  if (!value) {
    return null;
  }
  return value.toUpperCase();
}

function extractBoundedJson(text: string, startMarker: string, endMarker: string): string | null {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);

  if (start < 0 || end <= start) {
    return null;
  }

  const candidate = text.slice(start + startMarker.length, end).trim();
  if (!candidate.startsWith('{') || !candidate.endsWith('}')) {
    return null;
  }

  return candidate;
}

function sanitizeGovernanceJson(parsed: unknown): GovernanceErrorJson | null {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const payload = parsed as {
    errorCode?: unknown;
    code?: unknown;
    retryable?: unknown;
    source?: unknown;
    errors?: unknown;
  };

  let extractedCode = normalizeCode(payload.errorCode) ?? normalizeCode(payload.code);

  if (!extractedCode && Array.isArray(payload.errors)) {
    const errorCodes = payload.errors
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const error = entry as { code?: unknown; severity?: unknown };
        if (error.severity === 'error') {
          return normalizeCode(error.code);
        }
        return null;
      })
      .filter((value): value is string => value !== null)
      .sort((left, right) => left.localeCompare(right));

    extractedCode = errorCodes[0] ?? null;
  }

  const retryable = typeof payload.retryable === 'boolean' ? payload.retryable : null;
  const source = typeof payload.source === 'string' ? payload.source : null;

  if (!extractedCode && retryable === null && source === null) {
    return null;
  }

  return {
    code: normalizeCode(payload.code),
    errorCode: extractedCode,
    retryable,
    source
  };
}

function extractFromStructuredJson(text: string): GovernanceExtraction {
  const bounded = extractBoundedJson(text, GOVERNANCE_JSON_START_MARKER, GOVERNANCE_JSON_END_MARKER)
    ?? extractBoundedJson(text, 'GOVERNANCE_ERROR_JSON_START', 'GOVERNANCE_ERROR_JSON_END');

  if (!bounded) {
    return {
      governanceErrorCode: null,
      governanceErrorJson: null
    };
  }

  try {
    const parsed = JSON.parse(bounded) as unknown;
    const sanitized = sanitizeGovernanceJson(parsed);
    return {
      governanceErrorCode: sanitized?.errorCode ?? null,
      governanceErrorJson: sanitized
    };
  } catch {
    return {
      governanceErrorCode: null,
      governanceErrorJson: null
    };
  }
}

function extractFromKeyValue(text: string): string | null {
  const matches = Array.from(text.matchAll(/\b(?:errorCode|code)\s*[:=]\s*([A-Z0-9_-]+)\b/gi))
    .map((match) => normalizeCode(match[1]))
    .filter((value): value is string => value !== null)
    .sort((left, right) => left.localeCompare(right));

  return matches[0] ?? null;
}

function collectSearchText(raw?: RawCheck): string {
  if (!raw) {
    return '';
  }

  const segments = [raw.output?.summary, raw.output?.text]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  return segments.join('\n');
}

export function extractGovernanceError(governing: NormalizedCheck, raw?: RawCheck): GovernanceExtraction {
  if (governing.classification !== 'governance') {
    return {
      governanceErrorCode: null,
      governanceErrorJson: null
    };
  }

  const text = collectSearchText(raw);
  if (!text) {
    return {
      governanceErrorCode: null,
      governanceErrorJson: null
    };
  }

  const structured = extractFromStructuredJson(text);
  if (structured.governanceErrorCode) {
    return structured;
  }

  return {
    governanceErrorCode: extractFromKeyValue(text),
    governanceErrorJson: structured.governanceErrorJson
  };
}
