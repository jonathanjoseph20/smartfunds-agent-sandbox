import fs from 'node:fs';
import path from 'node:path';

import type { SlackBlock } from './slack-format.ts';

type SlackWebClient = {
  chat: {
    postMessage: (input: { channel: string; text: string; blocks: SlackBlock[] }) => Promise<unknown>;
    postEphemeral: (input: { user: string; channel: string; text: string; blocks: SlackBlock[] }) => Promise<unknown>;
  };
  files: {
    upload: (input: { channels: string; filename: string; file: Buffer }) => Promise<unknown>;
  };
};

const SUPPORTED_UPLOAD_EXTENSIONS = new Set(['.csv', '.xlsx', '.json', '.md', '.markdown']);

export function createSlackClient(client: SlackWebClient) {
  async function postMessage(channel: string, blocks: SlackBlock[]): Promise<void> {
    await client.chat.postMessage({
      channel,
      text: 'SmartFunds mission control update',
      blocks
    });
  }

  async function uploadFile(channel: string, filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_UPLOAD_EXTENSIONS.has(ext)) {
      throw new Error(`SLACK_UNSUPPORTED_FILE_TYPE: ${ext || 'none'}`);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`SLACK_ARTIFACT_NOT_FOUND: ${filePath}`);
    }

    const filename = path.basename(filePath);
    const file = fs.readFileSync(filePath);
    try {
      await client.files.upload({
        channels: channel,
        filename,
        file
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_upload_error';
      throw new Error(`SLACK_UPLOAD_FAILED: ${message}`);
    }
  }

  async function postEphemeral(user: string, channel: string, blocks: SlackBlock[]): Promise<void> {
    await client.chat.postEphemeral({
      user,
      channel,
      text: 'SmartFunds mission control response',
      blocks
    });
  }

  return {
    postMessage,
    uploadFile,
    postEphemeral
  };
}

export type SlackClient = ReturnType<typeof createSlackClient>;
