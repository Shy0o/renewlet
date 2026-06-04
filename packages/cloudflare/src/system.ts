import { systemVersionResponseSchema } from "@renewlet/shared/schemas/app";
import rootPackageJson from "../../../package.json";
import { requireAdmin } from "./auth";
import { HttpError, json, requestLocale } from "./http";
import { serverText } from "./server-i18n";
import type { Env } from "./types";

const DEV_VERSION = "0.0.0-dev";
const SHORT_COMMIT_LENGTH = 7;
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-rc\.\d+)?$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

/**
 * systemVersion 返回 Cloudflare 运行面的版本状态。
 *
 * Worker 部署没有可替换的本地二进制，前端只能展示版本和 Release 链接，不能复用 Docker 页面内更新流程。
 */
export async function systemVersion(request: Request, env: Env): Promise<Response> {
  await requireAdmin(request, env);
  const locale = requestLocale(request);
  const commit = cloudflareBuildValue(env.RENEWLET_COMMIT, "");
  const buildTime = cloudflareBuildValue(env.RENEWLET_BUILD_TIME, "");
  const version = resolveCloudflareVersion(env.RENEWLET_VERSION, commit);
  const releaseInfo = releaseInfoForVersion(version, buildTime);
  // Cloudflare 的 checkSucceeded 只表示“构建元数据和升级能力已读到”，不复用 Docker 的 GitHub Release 探测语义。
  return json(systemVersionResponseSchema.parse({
    currentVersion: version,
    latestVersion: version,
    hasUpdate: false,
    checkSucceeded: true,
    deployment: "cloudflare",
    updateMode: "cloudflare-deploy",
    updateSupported: false,
    unsupportedReason: serverText(locale, "system.cloudflareVersionUnsupportedReason"),
    releaseInfo,
    cached: false,
    build: {
      version,
      commit,
      buildTime,
      buildType: "cloudflare",
    },
  }));
}

/**
 * systemUpdate 明确拒绝 Cloudflare 页面内更新。
 *
 * Cloudflare 的发布入口是 Wrangler/Workers Builds，管理员按钮不能触发容器式下载、校验和重启状态机。
 */
export async function systemUpdate(request: Request, env: Env): Promise<Response> {
  await requireAdmin(request, env);
  const locale = requestLocale(request);
  throw new HttpError(400, serverText(locale, "system.cloudflareUpdateUnsupported"), "SYSTEM_UPDATE_UNSUPPORTED");
}

/**
 * systemRestart 明确拒绝 Cloudflare 页面内重启。
 *
 * Worker 发布由 Cloudflare 平台接管，没有 Docker restart pending 状态；错误码必须和 update 拆开，前端才能区分动作。
 */
export async function systemRestart(request: Request, env: Env): Promise<Response> {
  await requireAdmin(request, env);
  const locale = requestLocale(request);
  throw new HttpError(400, serverText(locale, "system.cloudflareRestartUnsupported"), "SYSTEM_RESTART_UNSUPPORTED");
}

function cloudflareBuildValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed;
}

function resolveCloudflareVersion(rawVersion: string | undefined, commit: string): string {
  const version = cloudflareBuildValue(rawVersion, "");
  if (version && version !== DEV_VERSION) return version;
  const shortCommit = shortCommitSuffix(commit);
  return `${rootPackageJson.version}-dev${shortCommit ? `+${shortCommit}` : ""}`;
}

function shortCommitSuffix(commit: string): string {
  const trimmed = commit.trim();
  if (!COMMIT_SHA_PATTERN.test(trimmed)) return "";
  return trimmed.slice(0, SHORT_COMMIT_LENGTH);
}

function releaseInfoForVersion(version: string, buildTime: string) {
  if (!RELEASE_VERSION_PATTERN.test(version)) return null;
  return {
    tagName: `v${version}`,
    version,
    name: "Renewlet",
    body: "",
    publishedAt: buildTime,
    htmlUrl: `https://github.com/zhiyingzzhou/renewlet/releases/tag/v${version}`,
    assets: [],
  };
}
