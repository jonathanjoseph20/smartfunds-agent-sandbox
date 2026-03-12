import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';
import { createMissionProposalInspection } from '../missions/proposals/mission-proposal-inspection.ts';
import { createMissionProposalRegistry } from '../missions/proposals/mission-proposal-registry.ts';
import type { MissionProposalInstance } from '../missions/proposals/mission-proposal-types.ts';

interface ParsedArgs {
  proposalFile?: string;
  definition?: string;
  template?: string;
  paramsFile?: string;
  sourcesFile?: string;
  rationaleFile?: string;
  createdBy?: 'founder' | 'agent' | 'system';
  createdFromKind?: 'action_plan' | 'portfolio_intelligence' | 'market_synthesis' | 'mission' | 'dag' | 'manual';
  createdFromId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8').trim();
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    const consume = (flag: string): string => {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`MISSING_ARGUMENT: ${flag}`);
      }
      index += 1;
      return value;
    };

    if (arg === '--proposal-file') {
      args.proposalFile = consume('--proposal-file');
      continue;
    }
    if (arg.startsWith('--proposal-file=')) {
      args.proposalFile = arg.slice('--proposal-file='.length);
      continue;
    }

    if (arg === '--definition') {
      args.definition = consume('--definition');
      continue;
    }
    if (arg.startsWith('--definition=')) {
      args.definition = arg.slice('--definition='.length);
      continue;
    }

    if (arg === '--template') {
      args.template = consume('--template');
      continue;
    }
    if (arg.startsWith('--template=')) {
      args.template = arg.slice('--template='.length);
      continue;
    }

    if (arg === '--params-file') {
      args.paramsFile = consume('--params-file');
      continue;
    }
    if (arg.startsWith('--params-file=')) {
      args.paramsFile = arg.slice('--params-file='.length);
      continue;
    }

    if (arg === '--sources-file') {
      args.sourcesFile = consume('--sources-file');
      continue;
    }
    if (arg.startsWith('--sources-file=')) {
      args.sourcesFile = arg.slice('--sources-file='.length);
      continue;
    }

    if (arg === '--rationale-file') {
      args.rationaleFile = consume('--rationale-file');
      continue;
    }
    if (arg.startsWith('--rationale-file=')) {
      args.rationaleFile = arg.slice('--rationale-file='.length);
      continue;
    }

    if (arg === '--created-by') {
      args.createdBy = consume('--created-by') as ParsedArgs['createdBy'];
      continue;
    }
    if (arg.startsWith('--created-by=')) {
      args.createdBy = arg.slice('--created-by='.length) as ParsedArgs['createdBy'];
      continue;
    }

    if (arg === '--created-from-kind') {
      args.createdFromKind = consume('--created-from-kind') as ParsedArgs['createdFromKind'];
      continue;
    }
    if (arg.startsWith('--created-from-kind=')) {
      args.createdFromKind = arg.slice('--created-from-kind='.length) as ParsedArgs['createdFromKind'];
      continue;
    }

    if (arg === '--created-from-id') {
      args.createdFromId = consume('--created-from-id');
      continue;
    }
    if (arg.startsWith('--created-from-id=')) {
      args.createdFromId = arg.slice('--created-from-id='.length);
      continue;
    }

    throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }

  const usesProposalFile = Boolean(args.proposalFile);
  const usesDefinitionFlow = Boolean(args.definition || args.template || args.paramsFile || args.sourcesFile || args.rationaleFile || args.createdBy || args.createdFromKind || args.createdFromId);

  if (usesProposalFile && usesDefinitionFlow) {
    throw new Error('INVALID_ARGUMENT_COMBINATION: --proposal-file cannot be combined with definition-mode flags');
  }

  if (!usesProposalFile && !args.definition) {
    throw new Error('MISSING_ARGUMENT: --proposal-file or --definition');
  }

  if (!usesProposalFile) {
    if (!args.paramsFile) {
      throw new Error('MISSING_ARGUMENT: --params-file');
    }
    if (!args.sourcesFile) {
      throw new Error('MISSING_ARGUMENT: --sources-file');
    }
    if (!args.rationaleFile) {
      throw new Error('MISSING_ARGUMENT: --rationale-file');
    }
    if (!args.createdBy) {
      throw new Error('MISSING_ARGUMENT: --created-by');
    }
    if (!args.createdFromKind) {
      throw new Error('MISSING_ARGUMENT: --created-from-kind');
    }
    if (!args.createdFromId) {
      throw new Error('MISSING_ARGUMENT: --created-from-id');
    }
  }

  return args;
}

function buildFromDefinition(args: ParsedArgs): Omit<MissionProposalInstance, 'proposalId'> {
  const registry = createMissionProposalRegistry();
  const definition = registry.getProposalDefinition(args.definition!);

  const parametersRaw = readJsonFile(args.paramsFile!);
  if (!isRecord(parametersRaw)) {
    throw new Error('MISSION_PROPOSAL_INVALID_INPUT: params file must be a JSON object');
  }

  const sourcesRaw = readJsonFile(args.sourcesFile!);
  if (!Array.isArray(sourcesRaw)) {
    throw new Error('MISSION_PROPOSAL_INVALID_INPUT: sources file must be a JSON array');
  }

  const rationale = readTextFile(args.rationaleFile!);
  const templateId = args.template ?? definition.defaultProposedTemplateId ?? '';

  return {
    proposalType: definition.proposalType,
    displayName: definition.displayName,
    summary: definition.summary,
    objective: `${definition.displayName}: ${definition.summary}`,
    rationale,
    proposedMissionType: definition.defaultProposedMissionType,
    proposedTemplateId: templateId,
    proposedParameters: parametersRaw,
    proposedFounderInstructions: '',
    requestedDeliverables: [],
    sourceReferences: sourcesRaw as MissionProposalInstance['sourceReferences'],
    linkedMissionIds: [],
    linkedDagIds: [],
    linkedActionPlanIds: [],
    linkedPortfolioIds: [],
    createdBy: {
      kind: args.createdBy!,
      id: `${args.createdBy}:cli-submit`,
      displayName: `CLI ${args.createdBy}`,
    },
    createdFrom: {
      kind: args.createdFromKind!,
      id: args.createdFromId!,
      reason: rationale,
    },
    approvalState: 'pending_review',
    proposalState: 'submitted',
    blockingReasons: [],
    limitations: [],
    recommendedPriority: definition.recommendedPriority,
    historyDigest: '',
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${canonicalStringify(value)}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const args = parseArgs(argv);
    const inspection = createMissionProposalInspection();

    if (args.proposalFile) {
      const raw = readJsonFile(args.proposalFile);
      if (!isRecord(raw)) {
        throw new Error('MISSION_PROPOSAL_INVALID_INPUT: proposal file must be a JSON object');
      }
      if (typeof raw.proposalId === 'string' && raw.proposalId.trim().length > 0) {
        printJson(inspection.submitProposal(raw as MissionProposalInstance));
      } else {
        printJson(inspection.submitProposalFromInput(raw as Omit<MissionProposalInstance, 'proposalId'>));
      }
      return 0;
    }

    printJson(inspection.submitProposalFromInput(buildFromDefinition(args)));
    return 0;
  } catch (error) {
    printJson({ error: (error as Error).message });
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exit(code);
  }).catch(() => {
    process.stdout.write(`${canonicalStringify({ error: 'unexpected_runtime_error' })}\n`);
    process.exit(2);
  });
}
