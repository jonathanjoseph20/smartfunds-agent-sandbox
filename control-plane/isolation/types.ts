export type IsolationStatus =
  | 'ok'
  | 'autonomous_structured_violation'
  | 'invalid_autonomous_branch_namespace'
  | 'autonomous_governance_core_mutation'
  | 'autonomous_financial_core_mutation'
  | 'autonomous_entity_registry_mutation'
  | 'autonomous_rail_registry_mutation';

export type IsolationViolationCode =
  | 'structured_path_in_autonomous_context'
  | 'governance_core_mutation_attempt'
  | 'financial_core_mutation_attempt'
  | 'entity_registry_mutation_attempt'
  | 'rail_registry_mutation_attempt'
  | 'invalid_branch_namespace';

export interface IsolationClassification {
  autonomousContextDetected: boolean;
  branchNamespaceValid: boolean;
  structuredPathsTouched: string[];
  autonomousPathsTouched: string[];
  isolationStatus: IsolationStatus;
  isolationViolations: IsolationViolationCode[];
}
