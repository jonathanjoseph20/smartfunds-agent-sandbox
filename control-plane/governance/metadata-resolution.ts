import fs from 'node:fs';

type ReadFile = (filePath: string) => string;
type ExistsSync = (filePath: string) => boolean;

export type LocalMetadataResolutionInput = {
  bodyFile?: string;
  labelsFile?: string;
  readFile?: ReadFile;
  existsSync?: ExistsSync;
};

export type LocalMetadataResolution = {
  body: string;
  labels: string[];
  metadataSource: {
    bodySource: 'cli' | 'stub' | 'template';
    bodyPath: string | null;
    labelSource: 'cli' | 'stub';
    labelsPath: string | null;
  };
};

function parseLabels(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function readRequiredFile(filePath: string, readFile: ReadFile, existsSync: ExistsSync): string {
  if (!existsSync(filePath)) {
    throw new Error(`Metadata file not found: ${filePath}`);
  }
  return readFile(filePath);
}

export function resolveLocalMetadata(input: LocalMetadataResolutionInput = {}): LocalMetadataResolution {
  const readFile = input.readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
  const existsSync = input.existsSync ?? ((filePath: string) => fs.existsSync(filePath));

  const bodyCandidates = input.bodyFile
    ? [{ path: input.bodyFile, source: 'cli' as const }]
    : [
        { path: '.pr-body.md', source: 'stub' as const },
        { path: 'pr-body.md', source: 'stub' as const },
        { path: '.github/pull_request_template.md', source: 'template' as const }
      ];

  let bodyPath: string | null;
  let bodySource: 'cli' | 'stub' | 'template';
  let body = '';

  if (input.bodyFile) {
      bodyPath = input.bodyFile;
      bodySource = 'cli';
      body = readRequiredFile(bodyPath, readFile, existsSync);
  } else {
    const resolved = bodyCandidates.find((candidate) => existsSync(candidate.path));
    if (resolved) {
      bodyPath = resolved.path;
      bodySource = resolved.source;
      body = readFile(resolved.path);
    } else {
      bodyPath = null;
      bodySource = 'stub';
      body = '';
    }
  }

  let labelsPath: string | null = null;
  let labelSource: 'cli' | 'stub' = 'stub';
  let labels: string[] = [];

  if (input.labelsFile) {
    labelsPath = input.labelsFile;
    labelSource = 'cli';
    labels = parseLabels(readRequiredFile(labelsPath, readFile, existsSync));
  } else if (existsSync('.pr-labels.txt')) {
    labelsPath = '.pr-labels.txt';
    labels = parseLabels(readFile(labelsPath));
  } else if (existsSync('pr-labels.txt')) {
    labelsPath = 'pr-labels.txt';
    labels = parseLabels(readFile(labelsPath));
  }

  return {
    body,
    labels,
    metadataSource: {
      bodySource,
      bodyPath,
      labelSource,
      labelsPath
    }
  };
}
