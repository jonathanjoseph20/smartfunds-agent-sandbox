import { invokeLLM } from '../llm/llm-adapter.ts';

type StructuredSchema = Record<string, string>;

function sortedSchemaEntries(schema: StructuredSchema): Array<[string, string]> {
  return Object.entries(schema)
    .filter(([key, value]) => key.trim().length > 0 && typeof value === 'string' && value.trim().length > 0)
    .sort(([left], [right]) => left.localeCompare(right));
}

function toSchemaPrompt(schema: StructuredSchema): string {
  const fields = sortedSchemaEntries(schema)
    .map(([key, type]) => `- ${key}: ${type}`)
    .join('\n');

  return [
    'Extract structured data from the input text.',
    'Return JSON object only, no markdown, no explanation.',
    'Use this schema exactly:',
    fields
  ].join('\n');
}

function extractJsonObjectCandidate(content: string): string | null {
  const start = content.indexOf('{');
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < content.length; index += 1) {
    const ch = content[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === '\\') {
        escaping = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }

  return null;
}

function normalizeObjectOrdering(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeObjectOrdering(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => [key, normalizeObjectOrdering(entryValue)] as const);

  return Object.fromEntries(entries);
}

export async function extractStructuredData(input: {
  text: string;
  schema: StructuredSchema;
}): Promise<Record<string, unknown>> {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (text.length === 0) {
    throw new Error('ERR_EXTRACT_INPUT: text is required');
  }

  const schemaEntries = sortedSchemaEntries(input.schema);
  if (schemaEntries.length === 0) {
    throw new Error('ERR_EXTRACT_INPUT: schema is required');
  }

  const response = await invokeLLM({
    prompt: `Text:\n${text}`,
    systemPrompt: toSchemaPrompt(input.schema)
  });

  const candidate = extractJsonObjectCandidate(response.content);
  if (!candidate) {
    throw new Error('ERR_EXTRACT_JSON: no JSON object found in LLM response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error('ERR_EXTRACT_JSON: invalid JSON in LLM response');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ERR_EXTRACT_JSON: structured output must be an object');
  }

  return normalizeObjectOrdering(parsed) as Record<string, unknown>;
}
