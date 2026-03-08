import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSlackClient } from '../slack-client.ts';

const tmpDir = path.join('runtime', 'slack', '__tests__', 'tmp');

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('slack client', () => {
  it('T-S80-C1 posts message and ephemeral blocks', async () => {
    const postMessage = vi.fn(async () => ({}));
    const postEphemeral = vi.fn(async () => ({}));
    const upload = vi.fn(async () => ({}));

    const client = createSlackClient({
      chat: { postMessage, postEphemeral },
      files: { upload }
    });

    await client.postMessage('C1', [{ type: 'section' }]);
    await client.postEphemeral('U1', 'C1', [{ type: 'section' }]);

    expect(postMessage).toHaveBeenCalledWith({
      channel: 'C1',
      text: 'SmartFunds mission control update',
      blocks: [{ type: 'section' }]
    });
    expect(postEphemeral).toHaveBeenCalledWith({
      user: 'U1',
      channel: 'C1',
      text: 'SmartFunds mission control response',
      blocks: [{ type: 'section' }]
    });
  });

  it('T-S80-C2 uploads supported files and rejects unsupported formats', async () => {
    const upload = vi.fn(async () => ({}));
    const client = createSlackClient({
      chat: { postMessage: vi.fn(async () => ({})), postEphemeral: vi.fn(async () => ({})) },
      files: { upload }
    });

    fs.mkdirSync(tmpDir, { recursive: true });
    const csvPath = path.join(tmpDir, 'companies.csv');
    fs.writeFileSync(csvPath, 'name\nacme\n', 'utf8');

    await client.uploadFile('C1', csvPath);
    expect(upload).toHaveBeenCalledTimes(1);

    const exePath = path.join(tmpDir, 'bad.exe');
    fs.writeFileSync(exePath, 'x', 'utf8');

    await expect(client.uploadFile('C1', exePath)).rejects.toThrow('SLACK_UNSUPPORTED_FILE_TYPE: .exe');
  });

  it('T-S81-C3 reports missing artifact and upload failures deterministically', async () => {
    const upload = vi.fn(async () => {
      throw new Error('rate_limited');
    });
    const client = createSlackClient({
      chat: { postMessage: vi.fn(async () => ({})), postEphemeral: vi.fn(async () => ({})) },
      files: { upload }
    });

    await expect(client.uploadFile('C1', 'runtime/slack/__tests__/tmp/absent.csv')).rejects.toThrow(
      'SLACK_ARTIFACT_NOT_FOUND'
    );

    fs.mkdirSync(tmpDir, { recursive: true });
    const csvPath = path.join(tmpDir, 'companies.csv');
    fs.writeFileSync(csvPath, 'name\nacme\n', 'utf8');

    await expect(client.uploadFile('C1', csvPath)).rejects.toThrow('SLACK_UPLOAD_FAILED: rate_limited');
  });
});
