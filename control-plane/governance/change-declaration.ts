import fs from 'node:fs';

export type ChangeDeclaration = {
  tier: 0 | 1 | 2 | 3;
  mode: 'structured' | 'autonomous';
  justification: string;
};

export const CHANGE_JSON_PATH = 'governance/change.json';

type ReadResult =
  | { ok: true; declaration: ChangeDeclaration }
  | { ok: false; errors: string[] };

export function readChangeDeclaration(path = CHANGE_JSON_PATH): ReadResult {
  if (!fs.existsSync(path)) {
    return {
      ok: false,
      errors: [`Missing ${path}. Create it with tier, mode, and justification fields.`]
    };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (err) {
    return { ok: false, errors: [`Cannot read ${path}: ${(err as Error).message}`] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, errors: [`${path} is not valid JSON.`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: [`${path} must be a JSON object.`] };
  }

  const obj = parsed as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj.tier !== 'number' || ![0, 1, 2, 3].includes(obj.tier as number)) {
    errors.push(`${path}: "tier" must be 0, 1, 2, or 3.`);
  }

  if (obj.mode !== 'structured' && obj.mode !== 'autonomous') {
    errors.push(`${path}: "mode" must be "structured" or "autonomous".`);
  }

  if (typeof obj.justification !== 'string' || !(obj.justification as string).trim()) {
    errors.push(`${path}: "justification" must be a non-empty string.`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    declaration: {
      tier: obj.tier as 0 | 1 | 2 | 3,
      mode: obj.mode as 'structured' | 'autonomous',
      justification: obj.justification as string
    }
  };
}
