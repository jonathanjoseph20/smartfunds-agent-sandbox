import { sha256 } from "./hash.js";
import { DocFactoryStore, TemplateRecord, TemplateType } from "./store.js";

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  version: string;
  exemption_type: "506C";
  placeholders: string[];
  content_hash: string;
  created_at: string;
  template_body: string;
}

const DEFAULT_TEMPLATES: Array<Omit<Template, "content_hash" | "created_at">> = [
  {
    id: "base_506c",
    name: "Base 506(c) Offering",
    type: "base",
    version: "1.0.0",
    exemption_type: "506C",
    placeholders: ["offering_name", "issuer_name", "target_raise", "jurisdiction", "minimum_investment", "offering_period"],
    template_body:
      "Offering {{offering_name}} by {{issuer_name}} targets {{target_raise}} in {{jurisdiction}} with minimum {{minimum_investment}} over {{offering_period}}."
  },
  {
    id: "art_module",
    name: "Art Asset Module",
    type: "asset_module",
    version: "1.0.0",
    exemption_type: "506C",
    placeholders: ["artwork_description", "artist_name", "provenance_summary", "valuation_method"],
    template_body:
      "Art module: {{artwork_description}} by {{artist_name}} with provenance {{provenance_summary}} valued via {{valuation_method}}."
  },
  {
    id: "mineral_royalty_module",
    name: "Mineral Royalty Module",
    type: "asset_module",
    version: "1.0.0",
    exemption_type: "506C",
    placeholders: ["mineral_type", "property_description", "royalty_percentage", "estimated_reserves"],
    template_body:
      "Mineral module: {{mineral_type}} at {{property_description}} royalty {{royalty_percentage}} reserves {{estimated_reserves}}."
  },
  {
    id: "generic_spv_module",
    name: "Generic SPV Module",
    type: "asset_module",
    version: "1.0.0",
    exemption_type: "506C",
    placeholders: ["asset_description", "asset_valuation"],
    template_body: "SPV module: {{asset_description}} valued at {{asset_valuation}}."
  }
];

function toTemplate(record: TemplateRecord): Template {
  return { ...record, placeholders: [...record.placeholders] };
}

function compareSemver(a: string, b: string): number {
  const aParts = a.split(".").map((part) => Number.parseInt(part, 10));
  const bParts = b.split(".").map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < 3; index += 1) {
    const delta = (aParts[index] ?? 0) - (bParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

export function seedDefaultTemplates(store: DocFactoryStore, createdAt?: string): Template[] {
  const timestamp = createdAt ?? new Date().toISOString();
  const seeded: Template[] = [];

  for (const template of DEFAULT_TEMPLATES) {
    const nextTemplate: Template = {
      ...template,
      placeholders: [...template.placeholders],
      created_at: timestamp,
      content_hash: sha256(template.template_body)
    };

    store.upsertTemplate(nextTemplate);
    seeded.push(nextTemplate);
  }

  return seeded;
}

export function getTemplate(store: DocFactoryStore, id: string, version?: string): Template | null {
  if (version) {
    const found = store.getTemplate(id, version);
    return found ? toTemplate(found) : null;
  }

  const versions = store.listTemplateVersions(id);
  if (versions.length === 0) {
    return null;
  }

  const [latest] = [...versions].sort((left, right) => compareSemver(right.version, left.version));
  return toTemplate(latest);
}

export function listTemplates(store: DocFactoryStore, opts?: { type?: TemplateType }): Template[] {
  const all = store.listTemplates().filter((template) => (opts?.type ? template.type === opts.type : true));
  const latestById = new Map<string, TemplateRecord>();

  for (const template of all) {
    const existing = latestById.get(template.id);
    if (!existing || compareSemver(template.version, existing.version) > 0) {
      latestById.set(template.id, template);
    }
  }

  return [...latestById.values()]
    .map(toTemplate)
    .sort((left, right) => left.id.localeCompare(right.id));
}
