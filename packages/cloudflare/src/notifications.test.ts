// Worker 通知测试保护 Cron/手动运行共享的内容收集口径，避免 D1 reminder_days 哨兵和 Go 后端分叉。
import { describe, expect, it, vi } from "vitest";
import { createDefaultAppSettings } from "@renewlet/shared/settings-defaults";
import type { ApiSubscription } from "@renewlet/shared/schemas/subscriptions";
import { collectNotificationItemsForLocalDate } from "./notifications";

vi.mock("./smtp", () => ({
  notificationSmtpConfig: () => {
    throw new Error("SMTP should not be used by notification collection tests");
  },
  sendSmtpEmail: async () => undefined,
}));

function subscription(overrides: Partial<ApiSubscription> = {}): ApiSubscription {
  return {
    id: "sub_quiet",
    name: "Quiet SaaS",
    price: 10,
    currency: "USD",
    billingCycle: "monthly",
    category: "productivity",
    status: "active",
    pinned: false,
    startDate: "2026-01-01",
    nextBillingDate: "2026-01-10",
    autoCalculateNextBillingDate: true,
    tags: [],
    reminderDays: 0,
    repeatReminderEnabled: false,
    repeatReminderInterval: "1h",
    repeatReminderWindow: "72h",
    ...overrides,
  };
}

describe("Cloudflare notifications", () => {
  it("skips subscriptions with disabled reminders", () => {
    const items = collectNotificationItemsForLocalDate(
      "2026-01-10",
      { ...createDefaultAppSettings(), timezone: "UTC", showExpired: false },
      [subscription({ reminderDays: -2 })],
    );

    expect(items).toEqual([]);
  });
});
