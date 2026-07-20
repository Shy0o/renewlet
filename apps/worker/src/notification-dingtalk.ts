/**
 * 钉钉自定义机器人发送器。
 *
 * 钉钉 webhook URL 含 access_token，sign 也是一次性签名凭据；错误详情只能保留脱敏后的响应与请求摘要。
 */
import type { NotificationEmailMessage } from "@renewlet/shared/email-template";
import type { ApiAppSettings } from "@renewlet/shared/schemas/settings";
import type { AppLocale } from "./http";
import { assertSafeOutboundUrl } from "./outbound-url-policy";
import { sendNotificationJson } from "./notification-http";
import { NotificationChannelError } from "./notification-errors";
import { serverFormat, serverText } from "./server-i18n";
import {
  createUpstreamErrorDetails,
  providerMessageFromResponse,
  redactUpstreamSecrets,
  upstreamProviderResponseFromFetchResponse,
  type UpstreamProviderResponse,
} from "./upstream-response";

type DingTalkResponse = {
  errcode?: unknown;
  errmsg?: unknown;
};

type DingTalkMarkdownPayload = {
  msgtype: "markdown";
  markdown: {
    title: string;
    text: string;
  };
};

type DingTalkTextPayload = {
  msgtype: "text";
  text: {
    content: string;
  };
};

type DingTalkPayload = DingTalkMarkdownPayload | DingTalkTextPayload;

const textEncoder = new TextEncoder();

export async function sendDingTalk(settings: ApiAppSettings, message: NotificationEmailMessage, locale: AppLocale): Promise<void> {
  const rawWebhook = required(settings.dingtalkWebhookUrl, serverText(locale, "service.dingtalkWebhookURL"), locale);
  const endpoint = await dingtalkEndpoint(rawWebhook, settings.dingtalkSecret, locale);
  const secrets = dingTalkSecrets(rawWebhook, endpoint.toString(), settings.dingtalkSecret);
  const response = await sendNotificationJson(endpoint, dingTalkPayload(settings, message), "DingTalk", locale, { secrets });
  await requireDingTalkSuccess(response, locale, secrets);
}

export async function dingtalkEndpoint(rawWebhook: string, secret: string, locale: AppLocale, nowMs = Date.now()): Promise<URL> {
  const endpoint = await assertSafeOutboundUrl(rawWebhook, locale);
  if (!secret.trim()) return endpoint;
  return await signedDingTalkWebhookUrl(endpoint, secret, nowMs);
}

export async function signedDingTalkWebhookUrl(endpoint: URL | string, secret: string, nowMs = Date.now()): Promise<URL> {
  const url = new URL(endpoint.toString());
  const timestamp = String(Math.floor(nowMs));
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(`${timestamp}\n${secret}`));
  // timestamp/sign 是钉钉加签凭据；覆盖旧 query，避免复制来的过期签名继续发送或进入诊断。
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", base64FromArrayBuffer(signature));
  return url;
}

function dingTalkPayload(settings: ApiAppSettings, message: NotificationEmailMessage): DingTalkPayload {
  const content = dingTalkMessageContent(message, settings.dingtalkKeyword);
  if (settings.dingtalkMessageType === "text") {
    return {
      msgtype: "text",
      text: { content },
    };
  }
  return {
    msgtype: "markdown",
    markdown: {
      title: message.title,
      text: content,
    },
  };
}

function dingTalkMessageContent(message: NotificationEmailMessage, keyword: string): string {
  let content = `${message.title}\n\n${message.content}\n\n${message.timestamp}`;
  if (!content.includes("Renewlet")) content = `Renewlet\n\n${content}`;
  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword && !content.includes(trimmedKeyword)) content = `${trimmedKeyword}\n\n${content}`;
  return content;
}

async function requireDingTalkSuccess(response: Response, locale: AppLocale, secrets: readonly string[]): Promise<void> {
  const providerResponse = await upstreamProviderResponseFromFetchResponse(response, { secrets });
  if (!response.ok) {
    const detail = dingTalkErrorDetail(providerResponse, locale, secrets);
    throw new NotificationChannelError(
      serverHttpError("DingTalk", response.status, detail, locale),
      createUpstreamErrorDetails({ responseText: detail, providerResponse }),
    );
  }
  const payload = parseDingTalkResponse(providerResponse.body);
  // 钉钉自定义机器人会把关键词/签名/IP 白名单失败包在 HTTP 200 里；errcode=0 才是真成功。
  if (!payload || typeof payload.errcode !== "number") {
    const detail = providerMessageFromResponse(providerResponse) ?? serverText(locale, "service.dingtalkResponseInvalid");
    throw new NotificationChannelError(
      serverHttpError("DingTalk", response.status, detail, locale),
      createUpstreamErrorDetails({ responseText: detail, providerResponse }),
    );
  }
  if (payload.errcode !== 0) {
    const detail = redactUpstreamSecrets(dingTalkResponseMessage(payload), secrets) || serverText(locale, "service.dingtalkResponseInvalid");
    throw new NotificationChannelError(
      serverHttpError("DingTalk", response.status, detail, locale),
      createUpstreamErrorDetails({ responseText: detail, providerResponse }),
    );
  }
}

function dingTalkErrorDetail(providerResponse: UpstreamProviderResponse, locale: AppLocale, secrets: readonly string[]): string {
  const payload = parseDingTalkResponse(providerResponse.body);
  const detail = payload ? redactUpstreamSecrets(dingTalkResponseMessage(payload), secrets) : "";
  return detail || providerMessageFromResponse(providerResponse) || serverText(locale, "service.dingtalkResponseInvalid");
}

function parseDingTalkResponse(value: string | null | undefined): DingTalkResponse | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as DingTalkResponse;
  } catch {
    return null;
  }
}

function dingTalkResponseMessage(payload: DingTalkResponse): string {
  const message = typeof payload.errmsg === "string" ? payload.errmsg.trim() : "";
  if (typeof payload.errcode !== "number") return message;
  return message ? `errcode=${payload.errcode} ${message}` : `errcode=${payload.errcode}`;
}

function dingTalkSecrets(rawWebhook: string, endpoint: string, secret: string): string[] {
  const out = [rawWebhook, endpoint, secret];
  try {
    const params = new URL(endpoint).searchParams;
    out.push(params.get("access_token") ?? "", params.get("sign") ?? "");
  } catch {
    // URL 已在发送前校验；这里只保守保留前面的 secret 列表。
  }
  return out;
}

function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

function serverHttpError(channel: string, status: number, detail: string, locale: AppLocale): string {
  return serverFormat(locale, "notification.httpSendFailed", {
    channel,
    status,
    detail: detail.trim().slice(0, 800),
  });
}

function required(value: string, label: string, locale: AppLocale): string {
  if (value.trim()) return value.trim();
  throw new Error(serverFormat(locale, "common.requiredField", { label }));
}
