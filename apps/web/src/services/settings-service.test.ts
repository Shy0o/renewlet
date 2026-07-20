import { describe, expect, it } from "vitest";
import { normalizeSettings } from "./settings-service";

describe("settings service normalization", () => {
  it("recovers invalid stored notification message enums without dropping other fields", () => {
    const settings = normalizeSettings({
      telegramMessageFormat: "markdown",
      dingtalkMessageType: "actionCard",
      monthlyBudget: 2333,
    });

    expect(settings.telegramMessageFormat).toBe("plain");
    expect(settings.dingtalkMessageType).toBe("markdown");
    expect(settings.monthlyBudget).toBe(2333);
  });
});
