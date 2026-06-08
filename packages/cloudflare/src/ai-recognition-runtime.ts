import { generateText, wrapLanguageModel, type JSONValue, type ModelMessage, type UserContent } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  aiRecognitionSettingsSchema,
  type AiRecognitionSettings,
  type AiThinkingControl,
} from "@renewlet/shared/schemas/ai-recognition";
import { resolveAIProviderEndpoint } from "@renewlet/shared/ai-provider-endpoints";
import { extractAIModelText, finishReasonText } from "./ai-recognition-diagnostics";

const AI_RECOGNITION_TEST_TEXT = "Reply with OK.";

export type AIRecognitionRuntimeInput = {
  text: string;
  images: Array<{ data: Uint8Array; mediaType: string }>;
};

export type AIRecognitionCapture = {
  rawModelText: string | null;
  usage: unknown | null;
  finishReason: string | null;
  providerMetadata: unknown | null;
};

export function createAIRecognitionModel(settings: AiRecognitionSettings, capture: AIRecognitionCapture) {
  const canonicalSettings = aiRecognitionSettingsSchema.parse(settings);
  const endpoint = resolveAIProviderEndpoint(canonicalSettings);
  const model = createAIRecognitionLanguageModel(canonicalSettings, endpoint.runtimeBaseUrl);

  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: "v3",
      async wrapGenerate({ doGenerate }) {
        const result = await doGenerate();
        capture.rawModelText = extractAIModelText(result.content) ?? capture.rawModelText;
        capture.usage = result.usage ?? capture.usage;
        capture.finishReason = finishReasonText(result.finishReason) ?? capture.finishReason;
        capture.providerMetadata = result.providerMetadata ?? capture.providerMetadata;
        return result;
      },
    },
  });
}

export function createAIRecognitionLanguageModel(settings: AiRecognitionSettings, runtimeBaseUrl: string) {
  if (settings.transportProtocol === "anthropic-messages") {
    return createAnthropic({
      apiKey: settings.apiKey,
      baseURL: runtimeBaseUrl,
    })(settings.model);
  }
  if (settings.transportProtocol === "gemini-generate-content") {
    return createGoogleGenerativeAI({
      apiKey: settings.apiKey,
      baseURL: runtimeBaseUrl,
    })(settings.model);
  }
  if (settings.providerType === "openai") {
    return createOpenAI({ apiKey: settings.apiKey, baseURL: runtimeBaseUrl }).chat(settings.model);
  }
  return createOpenAICompatible({
    name: settings.providerType,
    baseURL: runtimeBaseUrl,
    ...(settings.apiKey ? { apiKey: settings.apiKey } : {}),
    supportsStructuredOutputs: true,
  })(settings.model);
}

export async function runAIRecognitionConnectionTest(settings: AiRecognitionSettings): Promise<void> {
  const canonicalSettings = aiRecognitionSettingsSchema.parse(settings);
  // 连接测试刻意绕开 schema/repair/thinking/retry，只验证当前协议能完成最小文本生成。
  await generateText({
    model: createAIRecognitionLanguageModel(canonicalSettings, resolveAIProviderEndpoint(canonicalSettings).runtimeBaseUrl),
    prompt: AI_RECOGNITION_TEST_TEXT,
    maxOutputTokens: 16,
    maxRetries: 0,
  });
}

export function thinkingControlMatchesSettings(settings: AiRecognitionSettings, control: AiThinkingControl): boolean {
  if (settings.transportProtocol === "openai-chat") return settings.providerType === "openai" && control.provider === "openai";
  if (settings.transportProtocol === "anthropic-messages") return settings.providerType === "anthropic" && control.provider === "anthropic";
  return settings.providerType === "gemini" && control.provider === "gemini";
}

export function providerOptionsForThinking(settings: AiRecognitionSettings, control: AiThinkingControl | null): Record<string, Record<string, JSONValue>> | undefined {
  if (!control) return undefined;
  if (control.provider === "openai") {
    if (settings.providerType !== "openai" || settings.transportProtocol !== "openai-chat") return undefined;
    return { openai: { reasoningEffort: control.effort } };
  }
  if (control.provider === "gemini") {
    if (settings.providerType !== "gemini" || settings.transportProtocol !== "gemini-generate-content") return undefined;
    if (control.mode === "off") return { google: { thinkingConfig: { thinkingBudget: 0 } } };
    if (control.mode === "dynamic") return { google: { thinkingConfig: { thinkingBudget: -1 } } };
    if (control.mode === "budget") return { google: { thinkingConfig: { thinkingBudget: control.budget } } };
    return { google: { thinkingConfig: { thinkingLevel: control.level } } };
  }
  if (settings.providerType !== "anthropic" || settings.transportProtocol !== "anthropic-messages") return undefined;
  if (control.mode === "effort") {
    return { anthropic: { effort: control.effort } };
  }
  return { anthropic: { thinking: { type: "enabled", budgetTokens: control.budgetTokens } } };
}

export function buildAIRecognitionMessages(input: AIRecognitionRuntimeInput, userPrompt: string): ModelMessage[] {
  const content: UserContent = [
    { type: "text", text: userPrompt },
    ...input.images.map((image) => ({ type: "image" as const, image: image.data, mediaType: image.mediaType })),
  ];
  return [{ role: "user", content }];
}

export function todayDateOnly(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
