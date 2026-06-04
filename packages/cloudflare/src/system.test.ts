// Worker 系统更新测试保护 Cloudflare 只读升级契约，避免前端误暴露 Docker 页面内更新入口。
import rootPackageJson from "../../../package.json";
import { describe, expect, it, vi } from "vitest";
import { systemRestart, systemUpdate, systemVersion } from "./system";
import type { Env } from "./types";

vi.mock("./auth", () => ({
  requireAdmin: vi.fn(async () => ({
    token: "session-token",
    user: { id: "usr_admin", email: "admin@example.com", name: "Admin", role: "admin", banned: 0 },
  })),
}));

describe("Cloudflare system update contract", () => {
  it("returns deploy-only version capability", async () => {
    const response = await systemVersion(new Request("https://renewlet.example/api/app/admin/system/version", {
      headers: { "accept-language": "en-US" },
    }), envFixture());

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      currentVersion: "1.2.3",
      latestVersion: "1.2.3",
      deployment: "cloudflare",
      updateMode: "cloudflare-deploy",
      updateSupported: false,
      checkSucceeded: true,
      hasUpdate: false,
      build: {
        version: "1.2.3",
        commit: "504c1681822ac60f0caafdb0b1ba731853c9169d",
        buildType: "cloudflare",
      },
    });
    expect(body["releaseInfo"]).toMatchObject({
      tagName: "v1.2.3",
      version: "1.2.3",
      htmlUrl: "https://github.com/zhiyingzzhou/renewlet/releases/tag/v1.2.3",
      assets: [],
    });
    expect(body).not.toHaveProperty("runtime");
  });

  it("falls back from placeholder metadata to package version plus commit", async () => {
    const env = envFixture({
      RENEWLET_VERSION: "0.0.0-dev",
      RENEWLET_COMMIT: "504c1681822ac60f0caafdb0b1ba731853c9169d",
    });

    const response = await systemVersion(new Request("https://renewlet.example/api/app/admin/system/version", {
      headers: { "accept-language": "en-US" },
    }), env);

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    const expectedVersion = `${rootPackageJson.version}-dev+504c168`;
    expect(body).toMatchObject({
      currentVersion: expectedVersion,
      latestVersion: expectedVersion,
      checkSucceeded: true,
      hasUpdate: false,
      deployment: "cloudflare",
      releaseInfo: null,
      build: {
        version: expectedVersion,
        commit: "504c1681822ac60f0caafdb0b1ba731853c9169d",
        buildType: "cloudflare",
      },
    });
  });

  it("falls back to package dev version when commit metadata is missing", async () => {
    const env = envFixture();
    delete env.RENEWLET_VERSION;
    delete env.RENEWLET_COMMIT;

    const response = await systemVersion(new Request("https://renewlet.example/api/app/admin/system/version", {
      headers: { "accept-language": "en-US" },
    }), env);

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    const expectedVersion = `${rootPackageJson.version}-dev`;
    expect(body).toMatchObject({
      currentVersion: expectedVersion,
      latestVersion: expectedVersion,
      checkSucceeded: true,
      hasUpdate: false,
      deployment: "cloudflare",
      releaseInfo: null,
      build: {
        version: expectedVersion,
        commit: "",
        buildType: "cloudflare",
      },
    });
  });

  it("rejects executable updates in the Worker runtime", async () => {
    await expect(systemUpdate(new Request("https://renewlet.example/api/app/admin/system/update", {
      headers: { "accept-language": "en-US" },
      method: "POST",
    }), envFixture())).rejects.toMatchObject({
      status: 400,
      code: "SYSTEM_UPDATE_UNSUPPORTED",
    });
  });

  it("rejects executable restarts in the Worker runtime with a restart-specific code", async () => {
    await expect(systemRestart(new Request("https://renewlet.example/api/app/admin/system/restart", {
      headers: { "accept-language": "en-US" },
      method: "POST",
    }), envFixture())).rejects.toMatchObject({
      status: 400,
      code: "SYSTEM_RESTART_UNSUPPORTED",
    });
  });
});

function envFixture(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ASSETS_BUCKET: {} as R2Bucket,
    RENEWLET_VERSION: "1.2.3",
    RENEWLET_COMMIT: "504c1681822ac60f0caafdb0b1ba731853c9169d",
    RENEWLET_BUILD_TIME: "2026-06-02T00:00:00Z",
    ...overrides,
  };
}
