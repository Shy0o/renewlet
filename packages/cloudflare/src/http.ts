import { z } from "zod";
import { DEFAULT_SERVER_I18N_LOCALE, requestLocale, serverText, type AppLocale } from "./server-i18n";

const JSON_LIMIT_BYTES = 1 << 20;

export { requestLocale, type AppLocale } from "./server-i18n";

export function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(value), { ...init, headers });
}

export function ok(status = 200): Response {
  return json({ ok: true }, { status });
}

export function errorResponse(status: number, message: string, code?: string, details?: unknown): Response {
  return json({ message, ...(code ? { code } : {}), ...(details === undefined ? {} : { details }) }, { status });
}

export function methodNotAllowed(locale: AppLocale): Response {
  return errorResponse(405, serverText(locale, "common.methodNotAllowed"), "METHOD_NOT_ALLOWED");
}

export function privateShortCache(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, max-age=300");
  // 候选搜索结果带用户来源设置和认证语义；Vary Authorization 防止边缘缓存串用户。
  headers.set("vary", "Authorization");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function pathSegments(url: URL, prefix = "/api/app"): string[] {
  const path = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
  return path.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
}

export async function readJson<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  locale: AppLocale,
): Promise<z.infer<Schema>> {
  return readJsonWithLimit(request, schema, locale, JSON_LIMIT_BYTES);
}

export async function readJsonWithLimit<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  locale: AppLocale,
  limitBytes: number,
): Promise<z.infer<Schema>> {
  const text = await readLimitedTextWithLimit(request, locale, false, limitBytes);
  return parseJsonText(text, schema, locale);
}

function parseJsonText<Schema extends z.ZodType>(
  text: string,
  schema: Schema,
  locale: AppLocale,
): z.infer<Schema> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, serverText(locale, "common.invalidJson"), "INVALID_JSON");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    // Worker API 与 Go API 一样拒绝脏 payload；前端表单错误需要 details.flatten 定位字段。
    throw new HttpError(400, serverText(locale, "common.invalidPayload"), "INVALID_PAYLOAD", result.error.flatten());
  }
  return result.data;
}

export async function readOptionalJson<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  locale: AppLocale,
): Promise<z.infer<Schema>> {
  const text = await readLimitedText(request, locale, true);
  if (!text) return schema.parse({});
  return parseJsonText(text, schema, locale);
}

async function readLimitedText(request: Request, locale: AppLocale, allowEmpty: boolean): Promise<string> {
  return readLimitedTextWithLimit(request, locale, allowEmpty, JSON_LIMIT_BYTES);
}

async function readLimitedTextWithLimit(request: Request, locale: AppLocale, allowEmpty: boolean, limitBytes: number): Promise<string> {
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > limitBytes) {
    throw new HttpError(413, serverText(locale, "common.requestBodyTooLarge"), "BODY_TOO_LARGE");
  }
  const text = await readRequestTextUpToLimit(request, locale, limitBytes);
  if (!allowEmpty && text.trim() === "") {
    throw new HttpError(400, serverText(locale, "common.emptyBody"), "EMPTY_BODY");
  }
  return text;
}

async function readRequestTextUpToLimit(request: Request, locale: AppLocale, limitBytes: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limitBytes) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(413, serverText(locale, "common.requestBodyTooLarge"), "BODY_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toResponse(error: unknown): Response {
  if (error instanceof HttpError) return errorResponse(error.status, error.message, error.code, error.details);
  const message = error instanceof Error ? error.message : serverText(DEFAULT_SERVER_I18N_LOCALE, "common.internalError");
  return errorResponse(500, message || serverText(DEFAULT_SERVER_I18N_LOCALE, "common.internalError"), "INTERNAL_ERROR");
}
