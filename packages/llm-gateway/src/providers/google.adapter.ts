import { gatewayError, isGatewayError } from "../errors.js";
import type {
  LlmProviderAdapter,
  ProviderStructuredRequest,
  ProviderStructuredResult,
  ProviderTextRequest,
  ProviderTextResult
} from "./base.js";

interface GoogleGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function isProviderEnabled(): boolean {
  return process.env.LLM_ENABLE_PROVIDER_GOOGLE === "1";
}

function getApiKey(): string {
  return process.env.GOOGLE_API_KEY ?? "";
}

function extractText(response: GoogleGenerateResponse): string {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    return "";
  }
  return parts.map((part) => part.text ?? "").join("\n").trim();
}

function mapUsage(response: GoogleGenerateResponse): ProviderTextResult["usage"] {
  const usage = response.usageMetadata;
  if (!usage) return undefined;

  return {
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount
  };
}

async function postGoogle(
  request: ProviderTextRequest,
  schemaInstruction?: string
): Promise<GoogleGenerateResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw gatewayError("LLM_PROVIDER_DISABLED", "Google provider is missing GOOGLE_API_KEY");
  }

  const timeoutMs = request.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [request.systemPrompt, schemaInstruction, request.userPrompt].filter(Boolean).join("\n\n")
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: request.maxOutputTokens
      }
    };

    const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw gatewayError("LLM_PROVIDER_ERROR", "Google provider request failed", {
        status: response.status,
        body: errorBody.slice(0, 500)
      });
    }

    return (await response.json()) as GoogleGenerateResponse;
  } catch (error) {
    if (isGatewayError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("aborted") || message.includes("AbortError")) {
      throw gatewayError("LLM_PROVIDER_TIMEOUT", "Google provider request timed out", {
        timeoutMs
      });
    }

    throw gatewayError("LLM_PROVIDER_ERROR", "Google provider request failed", {
      message
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createGoogleProvider(): LlmProviderAdapter {
  return {
    providerId: "google",
    async generateText(request: ProviderTextRequest): Promise<ProviderTextResult> {
      if (!isProviderEnabled()) {
        throw gatewayError("LLM_PROVIDER_DISABLED", "Google provider is disabled");
      }

      const response = await postGoogle(request);
      return {
        text: extractText(response),
        providerModel: request.model,
        usage: mapUsage(response)
      };
    },
    async generateStructured(request: ProviderStructuredRequest): Promise<ProviderStructuredResult> {
      if (!isProviderEnabled()) {
        throw gatewayError("LLM_PROVIDER_DISABLED", "Google provider is disabled");
      }

      const schemaInstruction = [
        "Return only strict JSON. Do not include markdown code fences.",
        "The response must satisfy this schema:",
        JSON.stringify(request.schema)
      ].join("\n");

      const response = await postGoogle(request, schemaInstruction);
      return {
        rawText: extractText(response),
        providerModel: request.model,
        usage: mapUsage(response)
      };
    }
  };
}
