import { describe, expect, test } from "vitest";
import { assembleDocuments, getLatestAssemblyResult } from "../src/assembler.js";
import { MissingDealInputsError } from "../src/errors.js";
import { sha256 } from "../src/hash.js";
import { getTemplate, listTemplates, seedDefaultTemplates } from "../src/registry.js";
import { createFakeDocFactoryStore } from "../src/store.js";

const CREATED_AT = "2026-01-01T00:00:00.000Z";

function createSeededStore() {
  const store = createFakeDocFactoryStore();
  seedDefaultTemplates(store, CREATED_AT);
  return store;
}

function buildDealInputs() {
  return {
    offering_name: "Fund A",
    issuer_name: "SmartFunds Issuer LLC",
    target_raise: 1000000,
    jurisdiction: "US",
    minimum_investment: 10000,
    offering_period: "90 days",
    artwork_description: "Oil painting",
    artist_name: "A. Artist",
    provenance_summary: "Single owner",
    valuation_method: "Appraisal"
  };
}

describe("doc factory", () => {
  test("T-L1 template lookup returns latest and content_hash matches template_body hash", () => {
    const store = createSeededStore();
    const template = getTemplate(store, "base_506c");

    expect(template).not.toBeNull();
    expect(template?.content_hash).toBe(sha256(template?.template_body ?? ""));
  });

  test("T-L2 deterministic assembly hashes remain stable across two runs", () => {
    const store = createSeededStore();
    const payload = {
      store,
      mission_id: "mission-1",
      module_template_id: "art_module",
      deal_inputs: buildDealInputs(),
      created_at: CREATED_AT
    };

    const first = assembleDocuments(payload);
    const second = assembleDocuments(payload);

    expect(first.content_hash).toBe(second.content_hash);
    expect(first.document_set).toEqual(second.document_set);
  });

  test("T-L3 signature matrix correctness", () => {
    const store = createSeededStore();
    const result = assembleDocuments({
      store,
      mission_id: "mission-2",
      module_template_id: "art_module",
      deal_inputs: buildDealInputs(),
      created_at: CREATED_AT
    });

    expect(result.signature_matrix).toEqual([
      { document_name: "Subscription Agreement", required_signers: ["ISSUER", "INVESTOR"] },
      { document_name: "Private Placement Memorandum", required_signers: ["INVESTOR"] },
      { document_name: "Operating Agreement", required_signers: ["ISSUER"] },
      { document_name: "Accredited Investor Questionnaire", required_signers: ["INVESTOR"] }
    ]);
  });

  test("T-L4 template_versions_used includes base and module templates", () => {
    const store = createSeededStore();
    const result = assembleDocuments({
      store,
      mission_id: "mission-3",
      module_template_id: "art_module",
      deal_inputs: buildDealInputs(),
      created_at: CREATED_AT
    });

    expect(result.template_versions_used).toHaveLength(2);
    expect(result.template_versions_used.map((template) => template.id).sort()).toEqual(["art_module", "base_506c"]);
  });

  test("guardrail MissingDealInputsError returns sorted missing keys", () => {
    const store = createSeededStore();

    expect(() => {
      assembleDocuments({
        store,
        mission_id: "mission-4",
        module_template_id: "art_module",
        deal_inputs: {
          offering_name: "Fund A"
        },
        created_at: CREATED_AT
      });
    }).toThrowError(MissingDealInputsError);

    try {
      assembleDocuments({
        store,
        mission_id: "mission-4",
        module_template_id: "art_module",
        deal_inputs: {
          offering_name: "Fund A"
        },
        created_at: CREATED_AT
      });
    } catch (error) {
      const typedError = error as MissingDealInputsError;
      expect(typedError.missing_keys).toEqual([...typedError.missing_keys].sort());
    }
  });

  test("guardrail artifact persistence returns latest assembly result", () => {
    const store = createSeededStore();

    assembleDocuments({
      store,
      mission_id: "mission-5",
      module_template_id: "art_module",
      deal_inputs: buildDealInputs(),
      created_at: "2026-01-01T00:00:00.000Z"
    });

    const newer = assembleDocuments({
      store,
      mission_id: "mission-5",
      module_template_id: "art_module",
      deal_inputs: {
        ...buildDealInputs(),
        offering_name: "Fund B"
      },
      created_at: "2026-01-01T00:00:01.000Z"
    });

    expect(getLatestAssemblyResult(store, "mission-5")).toEqual(newer);
  });

  test("guardrail listTemplates type filtering", () => {
    const store = createSeededStore();

    expect(listTemplates(store, { type: "base" }).map((template) => template.id)).toEqual(["base_506c"]);
    expect(listTemplates(store, { type: "asset_module" }).map((template) => template.id)).toEqual([
      "art_module",
      "generic_spv_module",
      "mineral_royalty_module"
    ]);
  });
});
