import { gatewayError } from "../errors.js";
import type {
  LlmProviderAdapter,
  ProviderStructuredRequest,
  ProviderStructuredResult,
  ProviderTextRequest,
  ProviderTextResult,
  ProviderUsage
} from "./base.js";

export interface FakeProviderOptions {
  textResponse?: string;
  structuredResponse?: unknown;
  rawStructuredText?: string;
  failWith?: "timeout" | "provider_error" | null;
  usage?: ProviderUsage;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const sortedKeys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const parts = sortedKeys.map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`);
  return `{${parts.join(",")}}`;
}

export function createFakeProvider(options: FakeProviderOptions = {}): LlmProviderAdapter {
  const textResponse = options.textResponse ?? "fake-text-response";
  const structured = options.structuredResponse ?? { ok: true };
  const rawStructuredText = options.rawStructuredText ?? stableJson(structured);
  const usage = options.usage ?? {
    inputTokens: 10,
    outputTokens: 20,
    estimatedCostUsd: 0.001
  };

  async function maybeFail(requestId: string): Promise<void> {
    if (options.failWith === "timeout") {
      throw gatewayError("LLM_PROVIDER_TIMEOUT", "Fake provider timeout", { requestId, provider: "fake" });
    }

    if (options.failWith === "provider_error") {
      throw gatewayError("LLM_PROVIDER_ERROR", "Fake provider error", { requestId, provider: "fake" });
    }
  }

  return {
    providerId: "fake",
    async generateText(request: ProviderTextRequest): Promise<ProviderTextResult> {
      await maybeFail(request.requestId);
      return {
        text: textResponse,
        providerModel: request.model,
        usage
      };
    },
    async generateStructured(request: ProviderStructuredRequest): Promise<ProviderStructuredResult> {
      await maybeFail(request.requestId);
      return {
        rawText: rawStructuredText,
        providerModel: request.model,
        usage
      };
    }
  };
}
