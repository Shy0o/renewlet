import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/types/subscription";
import { sanitizeSettingsForExport } from "./import-export-model";

describe("sanitizeSettingsForExport", () => {
  it("strips external notification secrets unless explicitly included", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      discordWebhookUrl: "https://discord.com/api/webhooks/123/secret",
      discordBotUsername: "Renewlet",
      discordBotAvatarUrl: "https://cdn.example.com/avatar.png",
      pushplusToken: "push-token",
      dingtalkWebhookUrl: "https://oapi.dingtalk.com/robot/send?access_token=ding-token",
      dingtalkSecret: "SECsecret",
      dingtalkKeyword: "自定义关键词",
    };

    const sanitized = sanitizeSettingsForExport(settings, false);
    expect(sanitized).not.toHaveProperty("discordWebhookUrl");
    expect(sanitized).not.toHaveProperty("discordBotUsername");
    expect(sanitized).not.toHaveProperty("discordBotAvatarUrl");
    expect(sanitized).not.toHaveProperty("pushplusToken");
    expect(sanitized).not.toHaveProperty("dingtalkWebhookUrl");
    expect(sanitized).not.toHaveProperty("dingtalkSecret");
    expect(sanitized).not.toHaveProperty("dingtalkKeyword");
    expect(JSON.stringify(sanitized)).not.toContain("push-token");
    expect(JSON.stringify(sanitized)).not.toContain("ding-token");
    expect(JSON.stringify(sanitized)).not.toContain("SECsecret");

    const withSecrets = sanitizeSettingsForExport(settings, true);
    expect(withSecrets.discordWebhookUrl).toBe("https://discord.com/api/webhooks/123/secret");
    expect(withSecrets.discordBotUsername).toBe("Renewlet");
    expect(withSecrets.discordBotAvatarUrl).toBe("https://cdn.example.com/avatar.png");
    expect(withSecrets.pushplusToken).toBe("push-token");
    expect(withSecrets.dingtalkWebhookUrl).toBe("https://oapi.dingtalk.com/robot/send?access_token=ding-token");
    expect(withSecrets.dingtalkSecret).toBe("SECsecret");
    expect(withSecrets.dingtalkKeyword).toBe("自定义关键词");
  });
});
