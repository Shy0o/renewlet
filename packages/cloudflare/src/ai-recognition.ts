import { generateObject, Output, streamText, type JSONValue } from "ai";
import {
  AI_RECOGNITION_MAX_IMAGES,
  AI_RECOGNITION_MAX_IMAGE_BYTES,
  AI_RECOGNITION_MAX_TEXT_CHARS,
  aiGeneratedRecognizeObjectSchema,
  aiRecognitionErrorDetailsSchema,
  aiRecognitionSettingsSchema,
  aiRecognitionStreamEventSchema,
  aiRecognitionTestRequestSchema,
  aiRecognitionTestResponseSchema,
  aiThinkingControlSchema,
  type AiGeneratedRecognizeObject,
  type AiRecognitionDiagnostics,
  type AiRecognitionSettings,
  type AiRecognitionStreamEvent,
  type AiThinkingControl,
  type AiRecognizeResponse,
} from "@renewlet/shared/schemas/ai-recognition";
import { resolveAIProviderEndpoint } from "@renewlet/shared/ai-provider-endpoints";
import {
  AI_RECOGNITION_SCHEMA_NAME,
  type AIRecognitionPromptConfigContext,
  buildAIRecognitionSystemPrompt,
  buildAIRecognitionRepairUserPrompt,
  buildAIRecognitionUserPrompt,
} from "@renewlet/shared/ai-recognition-prompt";
import { getCustomConfig, getSettings, listSubscriptionTags } from "./db";
import { HttpError, json, readJson, requestLocale } from "./http";
import { serverText, type AppLocale } from "./server-i18n";
import { requireAuth } from "./auth";
import type { Env } from "./types";
import {
  aiRecognitionConfigContext,
  fillMissingNotesWithDynamicFallback,
  missingDescribableNoteNames,
  normalizeGeneratedAIRecognizeObject,
} from "./ai-recognition-normalize";
import { normalizeAIImageType } from "./ai-recognition-input";
import {
  aiRecognitionErrorDetails,
  buildAIRecognitionDiagnostics,
  finishReasonText,
  noObjectGeneratedFinishReason,
  noObjectGeneratedText,
  noObjectGeneratedUsage,
  safeAIRecognitionError,
} from "./ai-recognition-diagnostics";
import {
  buildAIRecognitionMessages,
  createAIRecognitionLanguageModel,
  createAIRecognitionModel,
  providerOptionsForThinking,
  runAIRecognitionConnectionTest,
  thinkingControlMatchesSettings,
  todayDateOnly,
  type AIRecognitionCapture,
} from "./ai-recognition-runtime";

const AI_RECOGNITION_MULTIPART_OVERHEAD = 1024 * 1024;
const AI_RECOGNITION_MAX_BODY_BYTES =
  AI_RECOGNITION_MAX_TEXT_CHARS * 4
  + AI_RECOGNITION_MAX_IMAGES * AI_RECOGNITION_MAX_IMAGE_BYTES
  + AI_RECOGNITION_MULTIPART_OVERHEAD;
type AIRecognitionInput = {
  text: string;
  images: Array<{ data: Uint8Array; mediaType: string }>;
  thinkingControl: AiThinkingControl | null;
};

type AIRecognitionGeneration = AIRecognitionCapture & {
  object: AiGeneratedRecognizeObject;
};

type AIRecognitionRunContext = {
  locale: AppLocale;
  settings: AiRecognitionSettings;
  input: AIRecognitionInput;
  thinkingControl: AiThinkingControl | null;
  timezone: string;
  defaultCurrency: string;
  configContext: AIRecognitionPromptConfigContext;
};

type AIRecognitionStreamSink = {
  emit: (event: AiRecognitionStreamEvent) => void;
};

class AIRecognitionRunError extends Error {
  constructor(
    readonly causeError: unknown,
    readonly diagnostics: AiRecognitionDiagnostics,
  ) {
    super(causeError instanceof Error ? causeError.message : String(causeError));
    this.name = "AIRecognitionRunError";
  }
}

class AIRecognitionGenerationError extends Error {
  constructor(
    readonly causeError: unknown,
    readonly capture: AIRecognitionCapture,
  ) {
    super(causeError instanceof Error ? causeError.message : String(causeError));
    this.name = "AIRecognitionGenerationError";
  }
}

/**
 * recognizeSubscriptions 只返回 AI 草稿。
 *
 * 真正写库仍必须由前端把草稿转成 import payload 后走 preview/apply，避免第三方模型输出绕过用户确认。
 */
export async function recognizeSubscriptions(request: Request, env: Env): Promise<Response> {
  const runContext = await prepareAIRecognitionRun(request, env);

  try {
    const response = await runAIRecognition({
      settings: runContext.settings,
      input: runContext.input,
      locale: runContext.locale,
      timezone: runContext.timezone,
      defaultCurrency: runContext.defaultCurrency,
      configContext: runContext.configContext,
      thinkingControl: runContext.thinkingControl,
      maxOutputTokens: 12000,
    });
    if (response.subscriptions.length === 0) {
      throw new HttpError(400, serverText(runContext.locale, "aiRecognition.noSubscriptions"), "AI_RECOGNITION_EMPTY", aiRecognitionErrorDetails("empty", null, response.diagnostics));
    }
    return json(response);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const diagnostics = aiRecognitionDiagnosticsFromError(error);
    const cause = aiRecognitionCauseFromError(error);
    if (isAIRecognitionSchemaMismatch(error)) {
      throw new HttpError(
        400,
        serverText(runContext.locale, "aiRecognition.schemaMismatch"),
        "AI_RECOGNITION_SCHEMA_MISMATCH",
        diagnostics ? aiRecognitionErrorDetails("schema_mismatch", cause, diagnostics) : safeAIRecognitionError(cause),
      );
    }
    throw new HttpError(
      400,
      serverText(runContext.locale, "aiRecognition.failed"),
      "AI_RECOGNITION_FAILED",
      diagnostics ? aiRecognitionErrorDetails("provider_failed", cause, diagnostics) : safeAIRecognitionError(cause),
    );
  }
}

export async function recognizeSubscriptionsStream(request: Request, env: Env): Promise<Response> {
  const runContext = await prepareAIRecognitionRun(request, env);
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: AiRecognitionStreamEvent) => {
        if (closed) return;
        // Worker 与 Go 必须发同构事件；每个事件先过 shared schema，防止调试原文或图片内容意外进入 SSE。
        const safeEvent = aiRecognitionStreamEventSchema.parse(event);
        controller.enqueue(encoder.encode(`event: ${safeEvent.type}\ndata: ${JSON.stringify(safeEvent)}\n\n`));
      };
      void (async () => {
        try {
          emit({ type: "recognition/progress", stage: "input-read" });
          const response = await runAIRecognitionStream({
            ...runContext,
            maxOutputTokens: 12000,
            abortSignal: request.signal,
            sink: { emit },
          });
          if (response.subscriptions.length === 0) {
            throw new HttpError(400, serverText(runContext.locale, "aiRecognition.noSubscriptions"), "AI_RECOGNITION_EMPTY", aiRecognitionErrorDetails("empty", null, response.diagnostics));
          }
          emit({ type: "recognition/final", response });
        } catch (error) {
          emit(aiRecognitionStreamErrorEvent(runContext.locale, error));
        } finally {
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      })();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-accel-buffering": "no",
    },
  });
}

async function prepareAIRecognitionRun(request: Request, env: Env): Promise<AIRecognitionRunContext> {
  const locale = requestLocale(request);
  const auth = await requireAuth(request, env);
  assertAIRecognitionContentLength(request, locale);
  const settings = await getSettings(env, auth.user.id);
  const aiSettings = aiRecognitionSettingsSchema.parse(settings.aiRecognition);
  const input = await readAIRecognitionInput(request, locale);
  const thinkingControl = input.thinkingControl;
  if (thinkingControl && !thinkingControlMatchesSettings(aiSettings, thinkingControl)) {
    throw new HttpError(400, serverText(locale, "aiRecognition.thinkingProviderMismatch"), "AI_THINKING_PROVIDER_MISMATCH");
  }
  assertAIRecognitionSettings(aiSettings, locale);
  // 配置项只作为模型上下文和响应归一化依据；新增分类/支付方式仍必须走 import preview/apply 用户确认链路。
  const [customConfig, existingTags] = await Promise.all([
    getCustomConfig(env, auth.user.id),
    listSubscriptionTags(env, auth.user.id),
  ]);
  return {
    locale,
    settings: aiSettings,
    input,
    thinkingControl,
    timezone: settings.timezone,
    defaultCurrency: settings.defaultCurrency,
    configContext: aiRecognitionConfigContext(customConfig, locale, existingTags),
  };
}

/** testAIRecognitionConnection 使用当前表单配置做一次最小文本调用；它不读取/写入持久设置。 */
export async function testAIRecognitionConnection(request: Request, env: Env): Promise<Response> {
  const locale = requestLocale(request);
  await requireAuth(request, env);
  const body = await readJson(request, aiRecognitionTestRequestSchema, locale);
  const settings = body.settings;
  assertAIRecognitionSettings(settings, locale);
  try {
    await runAIRecognitionConnectionTest(settings);
    return json(aiRecognitionTestResponseSchema.parse({
      ok: true,
      providerType: settings.providerType,
      transportProtocol: settings.transportProtocol,
      model: settings.model,
    }));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      serverText(locale, "aiRecognition.testFailed"),
      "AI_RECOGNITION_TEST_FAILED",
      safeAIRecognitionError(error),
    );
  }
}

function assertAIRecognitionContentLength(request: Request, locale: AppLocale): void {
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > AI_RECOGNITION_MAX_BODY_BYTES) {
    throw new HttpError(413, serverText(locale, "common.requestBodyTooLarge"), "BODY_TOO_LARGE");
  }
}

async function readAIRecognitionInput(
  request: Request,
  locale: AppLocale,
): Promise<AIRecognitionInput> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("too large") || message.includes("body size")) {
      throw new HttpError(413, serverText(locale, "common.requestBodyTooLarge"), "BODY_TOO_LARGE");
    }
    throw new HttpError(400, serverText(locale, "common.invalidPayload"), "AI_RECOGNITION_MULTIPART_INVALID");
  }
  for (const key of form.keys()) {
    if (key !== "text" && key !== "thinkingControl" && key !== "images" && key !== "images[]") {
      throw new HttpError(400, serverText(locale, "common.invalidPayload"), "AI_RECOGNITION_FIELD_INVALID");
    }
  }

  const textEntry = form.get("text");
  const text = typeof textEntry === "string" ? textEntry.trim() : "";
  if ([...text].length > AI_RECOGNITION_MAX_TEXT_CHARS) {
    throw new HttpError(413, serverText(locale, "common.requestBodyTooLarge"), "BODY_TOO_LARGE");
  }

  const thinkingEntry = form.get("thinkingControl");
  // 识别请求只认本次 multipart 明确携带的 thinking；设置页默认值由前端初始化选择，缺字段必须等价于未选择。
  const thinkingControl = parseAIThinkingControl(thinkingEntry, locale);
  const imageEntries = [...form.getAll("images"), ...form.getAll("images[]")].filter((value): value is File => value instanceof File);
  if (imageEntries.length > AI_RECOGNITION_MAX_IMAGES) {
    throw new HttpError(413, serverText(locale, "common.requestBodyTooLarge"), "BODY_TOO_LARGE");
  }
  const images: AIRecognitionInput["images"] = [];
  for (const file of imageEntries) {
    if (file.size <= 0) continue;
    if (file.size > AI_RECOGNITION_MAX_IMAGE_BYTES) {
      throw new HttpError(413, serverText(locale, "common.requestBodyTooLarge"), "BODY_TOO_LARGE");
    }
    const data = new Uint8Array(await file.arrayBuffer());
    images.push({ data, mediaType: normalizeAIImageType(file.type, data, locale) });
  }
  if (!text && images.length === 0) {
    throw new HttpError(400, serverText(locale, "aiRecognition.inputRequired"), "AI_RECOGNITION_INPUT_REQUIRED");
  }
  const totalBytes = new TextEncoder().encode(text).byteLength + images.reduce((sum, image) => sum + image.data.byteLength, 0);
  if (totalBytes > AI_RECOGNITION_MAX_BODY_BYTES) {
    throw new HttpError(413, serverText(locale, "common.requestBodyTooLarge"), "BODY_TOO_LARGE");
  }
  return { text, images, thinkingControl };
}

function parseAIThinkingControl(
  value: FormDataEntryValue | null,
  locale: AppLocale,
): AiThinkingControl | null {
  if (value === null) return null;
  if (value instanceof File) {
    throw new HttpError(400, serverText(locale, "common.invalidPayload"), "AI_THINKING_CONTROL_INVALID");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null") return null;
  let jsonValue: unknown;
  try {
    jsonValue = JSON.parse(trimmed) as unknown;
  } catch {
    throw new HttpError(400, serverText(locale, "common.invalidPayload"), "AI_THINKING_CONTROL_INVALID");
  }
  const parsed = aiThinkingControlSchema.safeParse(jsonValue);
  if (!parsed.success) {
    throw new HttpError(400, serverText(locale, "common.invalidPayload"), "AI_THINKING_CONTROL_INVALID", parsed.error.flatten());
  }
  return parsed.data;
}

async function runAIRecognition({
  settings,
  input,
  locale,
  timezone,
  defaultCurrency,
  configContext,
  thinkingControl,
  maxOutputTokens,
}: {
  settings: AiRecognitionSettings;
  input: AIRecognitionInput;
  locale: AppLocale;
  timezone: string;
  defaultCurrency: string;
  configContext: AIRecognitionPromptConfigContext;
  thinkingControl: AiThinkingControl | null;
  maxOutputTokens: number;
}): Promise<AiRecognizeResponse> {
  const providerOptions = providerOptionsForThinking(settings, thinkingControl);
  const systemPrompt = buildAIRecognitionSystemPrompt();
  const userPrompt = buildAIRecognitionUserPrompt({
    text: input.text,
    timezone,
    defaultCurrency,
    currentDate: todayDateOnly(timezone),
    imageCount: input.images.length,
    locale,
    configContext,
  });
  const capture: AIRecognitionCapture = {
    rawModelText: null,
    usage: null,
    finishReason: null,
    providerMetadata: null,
  };

  try {
    const initialGeneration = await generateAIRecognitionObject({
      settings,
      input,
      systemPrompt,
      userPrompt,
      providerOptions,
      maxOutputTokens,
    });
    let finalGeneration = initialGeneration;
    let diagnostics = diagnosticsFromGeneration(settings, input, thinkingControl, maxOutputTokens, systemPrompt, userPrompt, finalGeneration);
    let response = normalizeGeneratedAIRecognizeObject(finalGeneration.object, settings.providerType, settings.transportProtocol, settings.model, diagnostics, configContext);
    const missingNames = missingDescribableNoteNames(response.subscriptions);
    if (missingNames.length > 0) {
      const repairPrompt = buildAIRecognitionRepairUserPrompt({
        originalUserPrompt: userPrompt,
        previousObject: finalGeneration.object,
        missingNoteNames: missingNames,
      });
      try {
        finalGeneration = await generateAIRecognitionObject({
          settings,
          input,
          systemPrompt,
          userPrompt: repairPrompt,
          providerOptions,
          maxOutputTokens,
        });
        diagnostics = diagnosticsFromGeneration(settings, input, thinkingControl, maxOutputTokens, systemPrompt, repairPrompt, finalGeneration);
        const repairedResponse = normalizeGeneratedAIRecognizeObject(finalGeneration.object, settings.providerType, settings.transportProtocol, settings.model, diagnostics, configContext);
        if (repairedResponse.subscriptions.length > 0) response = repairedResponse;
      } catch {
        finalGeneration = initialGeneration;
        diagnostics = diagnosticsFromGeneration(settings, input, thinkingControl, maxOutputTokens, systemPrompt, userPrompt, finalGeneration);
        response = normalizeGeneratedAIRecognizeObject(finalGeneration.object, settings.providerType, settings.transportProtocol, settings.model, diagnostics, configContext);
      }
      response = fillMissingNotesWithDynamicFallback(response, locale, configContext);
    }
    return response;
  } catch (error) {
    const cause = error instanceof AIRecognitionGenerationError ? error.causeError : error;
    const errorCapture = error instanceof AIRecognitionGenerationError ? error.capture : capture;
    const rawModelText = noObjectGeneratedText(cause) ?? errorCapture.rawModelText;
    const diagnostics = buildAIRecognitionDiagnostics({
      settings,
      input,
      thinkingControl,
      maxOutputTokens,
      systemPrompt,
      userPrompt,
      rawModelText,
      rawObject: null,
      usage: noObjectGeneratedUsage(cause) ?? errorCapture.usage,
      finishReason: noObjectGeneratedFinishReason(cause) ?? errorCapture.finishReason,
      providerMetadata: errorCapture.providerMetadata,
    });
    throw new AIRecognitionRunError(cause, diagnostics);
  }
}

async function runAIRecognitionStream({
  settings,
  input,
  locale,
  timezone,
  defaultCurrency,
  configContext,
  thinkingControl,
  maxOutputTokens,
  abortSignal,
  sink,
}: {
  settings: AiRecognitionSettings;
  input: AIRecognitionInput;
  locale: AppLocale;
  timezone: string;
  defaultCurrency: string;
  configContext: AIRecognitionPromptConfigContext;
  thinkingControl: AiThinkingControl | null;
  maxOutputTokens: number;
  abortSignal: AbortSignal;
  sink: AIRecognitionStreamSink;
}): Promise<AiRecognizeResponse> {
  const providerOptions = providerOptionsForThinking(settings, thinkingControl);
  const systemPrompt = buildAIRecognitionSystemPrompt();
  const userPrompt = buildAIRecognitionUserPrompt({
    text: input.text,
    timezone,
    defaultCurrency,
    currentDate: todayDateOnly(timezone),
    imageCount: input.images.length,
    locale,
    configContext,
  });
  const capture: AIRecognitionCapture = {
    rawModelText: null,
    usage: null,
    finishReason: null,
    providerMetadata: null,
  };

  try {
    sink.emit({ type: "recognition/progress", stage: "model-start" });
    const initialGeneration = await generateAIRecognitionObjectStream({
      settings,
      input,
      systemPrompt,
      userPrompt,
      providerOptions,
      maxOutputTokens,
      abortSignal,
      sink,
    });
    let finalGeneration = initialGeneration;
    sink.emit({ type: "recognition/progress", stage: "validating" });
    let diagnostics = diagnosticsFromGeneration(settings, input, thinkingControl, maxOutputTokens, systemPrompt, userPrompt, finalGeneration);
    let response = normalizeGeneratedAIRecognizeObject(finalGeneration.object, settings.providerType, settings.transportProtocol, settings.model, diagnostics, configContext);
    const missingNames = missingDescribableNoteNames(response.subscriptions);
    if (missingNames.length > 0) {
      sink.emit({ type: "recognition/progress", stage: "repair-start" });
      const repairPrompt = buildAIRecognitionRepairUserPrompt({
        originalUserPrompt: userPrompt,
        previousObject: finalGeneration.object,
        missingNoteNames: missingNames,
      });
      try {
        finalGeneration = await generateAIRecognitionObjectStream({
          settings,
          input,
          systemPrompt,
          userPrompt: repairPrompt,
          providerOptions,
          maxOutputTokens,
          abortSignal,
          sink,
        });
        diagnostics = diagnosticsFromGeneration(settings, input, thinkingControl, maxOutputTokens, systemPrompt, repairPrompt, finalGeneration);
        const repairedResponse = normalizeGeneratedAIRecognizeObject(finalGeneration.object, settings.providerType, settings.transportProtocol, settings.model, diagnostics, configContext);
        if (repairedResponse.subscriptions.length > 0) response = repairedResponse;
      } catch {
        finalGeneration = initialGeneration;
        diagnostics = diagnosticsFromGeneration(settings, input, thinkingControl, maxOutputTokens, systemPrompt, userPrompt, finalGeneration);
        response = normalizeGeneratedAIRecognizeObject(finalGeneration.object, settings.providerType, settings.transportProtocol, settings.model, diagnostics, configContext);
      }
      response = fillMissingNotesWithDynamicFallback(response, locale, configContext);
    }
    sink.emit({ type: "recognition/progress", stage: "finalizing" });
    return response;
  } catch (error) {
    const cause = error instanceof AIRecognitionGenerationError ? error.causeError : error;
    const errorCapture = error instanceof AIRecognitionGenerationError ? error.capture : capture;
    const rawModelText = noObjectGeneratedText(cause) ?? errorCapture.rawModelText;
    const diagnostics = buildAIRecognitionDiagnostics({
      settings,
      input,
      thinkingControl,
      maxOutputTokens,
      systemPrompt,
      userPrompt,
      rawModelText,
      rawObject: null,
      usage: noObjectGeneratedUsage(cause) ?? errorCapture.usage,
      finishReason: noObjectGeneratedFinishReason(cause) ?? errorCapture.finishReason,
      providerMetadata: errorCapture.providerMetadata,
    });
    throw new AIRecognitionRunError(cause, diagnostics);
  }
}

async function generateAIRecognitionObject({
  settings,
  input,
  systemPrompt,
  userPrompt,
  providerOptions,
  maxOutputTokens,
}: {
  settings: AiRecognitionSettings;
  input: AIRecognitionInput;
  systemPrompt: string;
  userPrompt: string;
  providerOptions: Record<string, Record<string, JSONValue>> | undefined;
  maxOutputTokens: number;
}): Promise<AIRecognitionGeneration> {
  const capture: AIRecognitionCapture = {
    rawModelText: null,
    usage: null,
    finishReason: null,
    providerMetadata: null,
  };
  try {
    const result = await generateObject({
      model: createAIRecognitionModel(settings, capture),
      system: systemPrompt,
      messages: buildAIRecognitionMessages(input, userPrompt),
      schema: aiGeneratedRecognizeObjectSchema,
      schemaName: AI_RECOGNITION_SCHEMA_NAME,
      maxOutputTokens,
      ...(providerOptions ? { providerOptions } : {}),
      maxRetries: 1,
    });
    return {
      object: result.object,
      rawModelText: capture.rawModelText,
      usage: result.usage ?? capture.usage,
      finishReason: finishReasonText(result.finishReason) ?? capture.finishReason,
      providerMetadata: result.providerMetadata ?? capture.providerMetadata,
    };
  } catch (error) {
    throw new AIRecognitionGenerationError(error, capture);
  }
}

async function generateAIRecognitionObjectStream({
  settings,
  input,
  systemPrompt,
  userPrompt,
  providerOptions,
  maxOutputTokens,
  abortSignal,
  sink,
}: {
  settings: AiRecognitionSettings;
  input: AIRecognitionInput;
  systemPrompt: string;
  userPrompt: string;
  providerOptions: Record<string, Record<string, JSONValue>> | undefined;
  maxOutputTokens: number;
  abortSignal: AbortSignal;
  sink: AIRecognitionStreamSink;
}): Promise<AIRecognitionGeneration> {
  const capture: AIRecognitionCapture = {
    rawModelText: null,
    usage: null,
    finishReason: null,
    providerMetadata: null,
  };
  try {
    const result = streamText({
      model: createAIRecognitionLanguageModel(settings, resolveAIProviderEndpoint(settings).runtimeBaseUrl),
      system: systemPrompt,
      messages: buildAIRecognitionMessages(input, userPrompt),
      output: Output.object({
        schema: aiGeneratedRecognizeObjectSchema,
        name: AI_RECOGNITION_SCHEMA_NAME,
      }),
      maxOutputTokens,
      abortSignal,
      ...(providerOptions ? { providerOptions } : {}),
      maxRetries: 1,
    });
    const outputPromise = Promise.resolve(result.output);
    await Promise.all([
      outputPromise,
      consumeAIRecognitionFullStream(result.fullStream, sink, capture),
      consumeAIRecognitionPartialStream(result.partialOutputStream, sink),
    ]);
    const object = await outputPromise;
    return {
      object,
      rawModelText: capture.rawModelText,
      usage: await Promise.resolve(result.usage).catch(() => capture.usage),
      finishReason: finishReasonText(await Promise.resolve(result.finishReason).catch(() => capture.finishReason)) ?? capture.finishReason,
      providerMetadata: await Promise.resolve(result.providerMetadata).catch(() => capture.providerMetadata),
    };
  } catch (error) {
    throw new AIRecognitionGenerationError(error, capture);
  }
}

async function consumeAIRecognitionFullStream(
  fullStream: AsyncIterable<unknown>,
  sink: AIRecognitionStreamSink,
  capture: AIRecognitionCapture,
): Promise<void> {
  let rawModelText = "";
  for await (const part of fullStream) {
    if (!isRecord(part)) continue;
    switch (part["type"]) {
      case "text-delta": {
        const text = typeof part["delta"] === "string" ? part["delta"] : "";
        if (text) {
          rawModelText += text;
          capture.rawModelText = rawModelText;
          sink.emit({ type: "recognition/text-delta", delta: text });
          sink.emit({ type: "recognition/progress", stage: "model-stream" });
        }
        break;
      }
      case "reasoning-delta": {
        const text = typeof part["delta"] === "string" ? part["delta"] : "";
        if (text) {
          sink.emit({ type: "recognition/reasoning-delta", delta: text });
        }
        break;
      }
      case "finish-step":
      case "finish": {
        capture.usage = part["usage"] ?? capture.usage;
        capture.finishReason = finishReasonText(part["finishReason"]) ?? capture.finishReason;
        capture.providerMetadata = part["providerMetadata"] ?? capture.providerMetadata;
        break;
      }
      case "error":
        throw part["error"];
    }
  }
}

async function consumeAIRecognitionPartialStream(
  partialOutputStream: AsyncIterable<unknown>,
  sink: AIRecognitionStreamSink,
): Promise<void> {
  for await (const partial of partialOutputStream) {
    const { subscriptionsSeen, warningsSeen } = partialAIRecognitionCounts(partial);
    sink.emit({ type: "recognition/partial", subscriptionsSeen, warningsSeen });
  }
}

function partialAIRecognitionCounts(value: unknown): { subscriptionsSeen: number; warningsSeen: number } {
  if (!isRecord(value)) return { subscriptionsSeen: 0, warningsSeen: 0 };
  const subscriptions = value["subscriptions"];
  const warnings = value["warnings"];
  return {
    subscriptionsSeen: Array.isArray(subscriptions) ? subscriptions.length : 0,
    warningsSeen: Array.isArray(warnings) ? warnings.length : 0,
  };
}

function diagnosticsFromGeneration(
  settings: AiRecognitionSettings,
  input: AIRecognitionInput,
  thinkingControl: AiThinkingControl | null,
  maxOutputTokens: number,
  systemPrompt: string,
  userPrompt: string,
  generation: AIRecognitionGeneration,
): AiRecognitionDiagnostics {
  return buildAIRecognitionDiagnostics({
    settings,
    input,
    thinkingControl,
    maxOutputTokens,
    systemPrompt,
    userPrompt,
    rawModelText: generation.rawModelText,
    rawObject: generation.object,
    usage: generation.usage,
    finishReason: generation.finishReason,
    providerMetadata: generation.providerMetadata,
  });
}

function assertAIRecognitionSettings(settings: AiRecognitionSettings, locale: AppLocale): void {
  if (!settings.model.trim()) {
    throw new HttpError(400, serverText(locale, "aiRecognition.modelRequired"), "AI_MODEL_REQUIRED");
  }
  const endpoint = resolveAIProviderEndpoint(settings);
  if (endpoint.baseUrlRequired && !settings.baseUrl.trim()) {
    throw new HttpError(400, serverText(locale, "aiRecognition.baseUrlRequired"), "AI_BASE_URL_REQUIRED");
  }
  if (endpoint.apiKeyRequired && !settings.apiKey.trim()) {
    throw new HttpError(400, serverText(locale, "aiRecognition.apiKeyRequired"), "AI_API_KEY_REQUIRED");
  }
}

function aiRecognitionStreamErrorEvent(locale: AppLocale, error: unknown): AiRecognitionStreamEvent {
  if (error instanceof HttpError) {
    const parsedDetails = aiRecognitionErrorDetailsSchema.safeParse(error.details);
    return aiRecognitionStreamEventSchema.parse({
      type: "recognition/error",
      message: error.message,
      code: error.code ?? "AI_RECOGNITION_FAILED",
      ...(parsedDetails.success ? { details: parsedDetails.data } : {}),
    });
  }
  const diagnostics = aiRecognitionDiagnosticsFromError(error);
  const cause = aiRecognitionCauseFromError(error);
  if (diagnostics && isAIRecognitionSchemaMismatch(error)) {
    return aiRecognitionStreamEventSchema.parse({
      type: "recognition/error",
      message: serverText(locale, "aiRecognition.schemaMismatch"),
      code: "AI_RECOGNITION_SCHEMA_MISMATCH",
      details: aiRecognitionErrorDetails("schema_mismatch", cause, diagnostics),
    });
  }
  return aiRecognitionStreamEventSchema.parse({
    type: "recognition/error",
    message: serverText(locale, "aiRecognition.failed"),
    code: "AI_RECOGNITION_FAILED",
    ...(diagnostics ? { details: aiRecognitionErrorDetails("provider_failed", cause, diagnostics) } : {}),
  });
}

function isAIRecognitionSchemaMismatch(error: unknown): boolean {
  const cause = aiRecognitionCauseFromError(error);
  const message = (cause instanceof Error ? cause.message : String(cause)).toLowerCase();
  return message.includes("no object generated")
    || message.includes("did not match schema")
    || message.includes("schema validation")
    || message.includes("invalid object");
}

function aiRecognitionDiagnosticsFromError(error: unknown): AiRecognitionDiagnostics | null {
  return error instanceof AIRecognitionRunError ? error.diagnostics : null;
}

function aiRecognitionCauseFromError(error: unknown): unknown {
  return error instanceof AIRecognitionRunError ? error.causeError : error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
