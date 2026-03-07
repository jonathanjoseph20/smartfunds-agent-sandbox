import fs from 'node:fs';
import path from 'node:path';

import type { ValidatedWorkflowDefinition, WorkflowDefinition, WorkflowNode } from './workflow-types.ts';
import { validateWorkflowDefinition } from './workflow-validator.ts';

const DEFAULT_WORKFLOWS_DIR = 'control-plane/workflows/definitions';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function sortNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeWorkflowDefinition(workflow: WorkflowDefinition): ValidatedWorkflowDefinition {
  return {
    workflowId: workflow.workflowId,
    nodes: sortNodes(workflow.nodes).map((node) => ({
      id: node.id,
      task: node.task,
      ...(node.agent ? { agent: node.agent } : {}),
      ...(node.phase ? { phase: node.phase } : {}),
      dependsOn: sortedUnique(node.dependsOn ?? [])
    }))
  };
}

export function loadWorkflowDefinition(input: unknown): ValidatedWorkflowDefinition {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('workflow.load_failed: workflow definition must be an object');
  }

  const workflow = input as WorkflowDefinition;
  const result = validateWorkflowDefinition(workflow);

  if (!result.valid) {
    throw new Error(`workflow.validation_failed: ${result.errors.join('; ')}`);
  }

  return normalizeWorkflowDefinition(workflow);
}

export function loadWorkflowFromFile(filePath: string): ValidatedWorkflowDefinition {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  return loadWorkflowDefinition(parsed);
}

export function loadWorkflowDefinitionById(workflowId: string, dir: string = DEFAULT_WORKFLOWS_DIR): ValidatedWorkflowDefinition {
  const filePath = path.join(dir, `${workflowId}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`workflow.definition_not_found: ${workflowId}`);
  }

  return loadWorkflowFromFile(filePath);
}
