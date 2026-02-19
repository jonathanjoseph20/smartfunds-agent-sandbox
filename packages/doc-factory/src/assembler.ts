import { buildMissionArtifact, DocFactoryStore } from "./store.js";
import { MissingDealInputsError } from "./errors.js";
import { getTemplate, Template } from "./registry.js";
import { sha256, stableStringify } from "./hash.js";

export type DealInputs = Record<string, string | number>;

export interface TemplateVersionUsed {
  id: string;
  version: string;
  content_hash: string;
}

export interface AssembledDocument {
  name: "Subscription Agreement" | "Private Placement Memorandum" | "Operating Agreement" | "Accredited Investor Questionnaire";
  audience: "ISSUER" | "INVESTOR";
  content_hash: string;
}

export interface SignatureRequirement {
  document_name: AssembledDocument["name"];
  required_signers: Array<"ISSUER" | "INVESTOR">;
}

export interface EnforcementRequirement {
  gate: "ACCREDITATION_GATE" | "SIGNATURE_GATE";
  stage: "PRE_SUBSCRIPTION";
}

export interface AssemblyResult {
  mission_id: string;
  base_template_id: string;
  module_template_id: string;
  document_set: AssembledDocument[];
  template_versions_used: TemplateVersionUsed[];
  signature_matrix: SignatureRequirement[];
  enforcement_requirements: EnforcementRequirement[];
  content_hash: string;
  created_at: string;
}

const ASSEMBLY_ARTIFACT_TYPE = "DOCUMENT_ASSEMBLY_RESULT";

export function assembleDocuments(input: {
  store: DocFactoryStore;
  mission_id: string;
  base_template_id?: string;
  base_template_version?: string;
  module_template_id: string;
  module_template_version?: string;
  deal_inputs: DealInputs;
  created_at?: string;
}): AssemblyResult {
  const baseTemplate = mustGetTemplate(input.store, input.base_template_id ?? "base_506c", input.base_template_version);
  const moduleTemplate = mustGetTemplate(input.store, input.module_template_id, input.module_template_version);

  validateDealInputs(baseTemplate, moduleTemplate, input.deal_inputs);

  const template_versions_used: TemplateVersionUsed[] = [
    toTemplateVersion(baseTemplate),
    toTemplateVersion(moduleTemplate)
  ];

  const documentBlueprint: Array<Pick<AssembledDocument, "name" | "audience">> = [
    { name: "Subscription Agreement", audience: "ISSUER" },
    { name: "Private Placement Memorandum", audience: "INVESTOR" },
    { name: "Operating Agreement", audience: "ISSUER" },
    { name: "Accredited Investor Questionnaire", audience: "INVESTOR" }
  ];

  const document_set: AssembledDocument[] = documentBlueprint.map((document) => ({
    ...document,
    content_hash: buildDocumentHash(document.name, template_versions_used, input.deal_inputs)
  }));

  const signature_matrix: SignatureRequirement[] = [
    { document_name: "Subscription Agreement", required_signers: ["ISSUER", "INVESTOR"] },
    { document_name: "Private Placement Memorandum", required_signers: ["INVESTOR"] },
    { document_name: "Operating Agreement", required_signers: ["ISSUER"] },
    { document_name: "Accredited Investor Questionnaire", required_signers: ["INVESTOR"] }
  ];

  const enforcement_requirements: EnforcementRequirement[] = [
    { gate: "ACCREDITATION_GATE", stage: "PRE_SUBSCRIPTION" },
    { gate: "SIGNATURE_GATE", stage: "PRE_SUBSCRIPTION" }
  ];

  const created_at = input.created_at ?? new Date().toISOString();
  const artifactLike = {
    mission_id: input.mission_id,
    base_template_id: baseTemplate.id,
    module_template_id: moduleTemplate.id,
    document_set,
    template_versions_used,
    signature_matrix,
    enforcement_requirements,
    created_at
  };

  const content_hash = sha256(stableStringify(artifactLike));
  const assemblyResult: AssemblyResult = {
    ...artifactLike,
    content_hash
  };

  input.store.insertMissionArtifact(
    buildMissionArtifact(input.mission_id, ASSEMBLY_ARTIFACT_TYPE, stableStringify(assemblyResult), content_hash, created_at)
  );

  return assemblyResult;
}

export function getLatestAssemblyResult(store: DocFactoryStore, mission_id: string): AssemblyResult | null {
  const artifacts = store.listMissionArtifacts(mission_id, ASSEMBLY_ARTIFACT_TYPE);
  if (artifacts.length === 0) {
    return null;
  }

  const [latest] = [...artifacts].sort((left, right) => {
    if (left.created_at === right.created_at) {
      return left.id.localeCompare(right.id);
    }
    return left.created_at.localeCompare(right.created_at);
  }).slice(-1);

  return JSON.parse(latest.artifact_data) as AssemblyResult;
}

function validateDealInputs(baseTemplate: Template, moduleTemplate: Template, dealInputs: DealInputs): void {
  const required = new Set([...baseTemplate.placeholders, ...moduleTemplate.placeholders]);
  const missing = [...required].filter((key) => !Object.hasOwn(dealInputs, key));

  if (missing.length > 0) {
    throw new MissingDealInputsError(missing);
  }
}

function buildDocumentHash(
  documentName: AssembledDocument["name"],
  templateVersionsUsed: TemplateVersionUsed[],
  dealInputs: DealInputs
): string {
  const templateRefs = templateVersionsUsed
    .map((templateVersion) => `${templateVersion.id}@${templateVersion.version}:${templateVersion.content_hash}`)
    .sort();

  const dealInputLines = Object.keys(dealInputs)
    .sort()
    .map((key) => `${key}=${String(dealInputs[key])}`);

  return sha256([documentName, ...templateRefs, ...dealInputLines].join("\n"));
}

function mustGetTemplate(store: DocFactoryStore, id: string, version?: string): Template {
  const template = getTemplate(store, id, version);
  if (!template) {
    throw new Error(`Template not found: ${id}${version ? `@${version}` : ""}`);
  }

  return template;
}

function toTemplateVersion(template: Template): TemplateVersionUsed {
  return {
    id: template.id,
    version: template.version,
    content_hash: template.content_hash
  };
}
