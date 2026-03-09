import { describe, expect, it, vi } from 'vitest';

import { extractStructuredData } from './extract-adapter.ts';

vi.mock('../llm/llm-adapter.ts', () => ({
  invokeLLM: vi.fn()
}));

import { invokeLLM } from '../llm/llm-adapter.ts';

describe('extract adapter', () => {
  it('T-EA1 converts schema to prompt and returns ordered object', async () => {
    const mockedInvokeLLM = vi.mocked(invokeLLM);
    mockedInvokeLLM.mockResolvedValueOnce({
      model: 'gpt-4o-mini',
      content: '{"stage":"growth","company":"Alpha"}',
      usage: {
        promptTokens: 10,
        completionTokens: 8
      }
    });

    const output = await extractStructuredData({
      text: 'Alpha is in growth stage.',
      schema: {
        company: 'string',
        stage: 'string'
      }
    });

    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
    expect(output).toEqual({
      company: 'Alpha',
      stage: 'growth'
    });
  });

  it('T-EA2 rejects missing json object in llm output', async () => {
    const mockedInvokeLLM = vi.mocked(invokeLLM);
    mockedInvokeLLM.mockResolvedValueOnce({
      model: 'gpt-4o-mini',
      content: 'no json here',
      usage: {
        promptTokens: 1,
        completionTokens: 1
      }
    });

    await expect(extractStructuredData({
      text: 'Text',
      schema: { company: 'string' }
    })).rejects.toThrow('ERR_EXTRACT_JSON: no JSON object found in LLM response');
  });

  it('T-EA3 validates text and schema input', async () => {
    await expect(extractStructuredData({
      text: '   ',
      schema: { company: 'string' }
    })).rejects.toThrow('ERR_EXTRACT_INPUT: text is required');

    await expect(extractStructuredData({
      text: 'text',
      schema: {}
    })).rejects.toThrow('ERR_EXTRACT_INPUT: schema is required');
  });
});
