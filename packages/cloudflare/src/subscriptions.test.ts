// Worker 订阅 mapper 测试保护 D1 行契约，避免新增字段在 create/update/import/export 边界漂移。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toApiSubscription } from "./db";
import { toSubscriptionRow, type SubscriptionBody } from "./subscriptions";

function subscriptionBody(overrides: Partial<SubscriptionBody> = {}): SubscriptionBody {
  return {
    name: "Three Year Plan",
    logo: null,
    price: 360,
    currency: "USD",
    billingCycle: "monthly",
    customDays: null,
    customCycleUnit: null,
    oneTimeTermCount: null,
    oneTimeTermUnit: null,
    category: "productivity",
    status: "active",
    pinned: false,
    paymentMethod: null,
    startDate: "2026-05-14",
    nextBillingDate: "2029-05-14",
    autoCalculateNextBillingDate: true,
    trialEndDate: null,
    website: null,
    notes: null,
    tags: [],
    reminderDays: 3,
    repeatReminderEnabled: false,
    repeatReminderInterval: "1h",
    repeatReminderWindow: "72h",
    extra: {},
    ...overrides,
  };
}

describe("Cloudflare subscription mapper", () => {
  it("persists and exposes custom cycle units", () => {
    const row = toSubscriptionRow("sub_custom", "usr_custom", subscriptionBody({
      billingCycle: "custom",
      customDays: 3,
      customCycleUnit: "year",
    }), "2026-06-05T00:00:00.000Z", "2026-06-05T00:00:00.000Z");

    expect(row.custom_days).toBe(3);
    expect(row.custom_cycle_unit).toBe("year");
    expect(toApiSubscription(row)).toMatchObject({
      billingCycle: "custom",
      customDays: 3,
      customCycleUnit: "year",
    });
  });

  it("clears custom fields for fixed cycles", () => {
    const row = toSubscriptionRow("sub_monthly", "usr_custom", subscriptionBody({
      billingCycle: "monthly",
      customDays: 45,
      customCycleUnit: "week",
    }), "2026-06-05T00:00:00.000Z", "2026-06-05T00:00:00.000Z");

    const apiSubscription = toApiSubscription(row);

    expect(row.custom_days).toBeNull();
    expect(row.custom_cycle_unit).toBeNull();
    expect(apiSubscription).not.toHaveProperty("customDays");
    expect(apiSubscription).not.toHaveProperty("customCycleUnit");
  });

  it("persists one-time fixed terms and exposes them through the API mapper", () => {
    const row = toSubscriptionRow("sub_one_time", "usr_custom", subscriptionBody({
      billingCycle: "one-time",
      oneTimeTermCount: 6,
      oneTimeTermUnit: "month",
      customDays: 45,
      customCycleUnit: "week",
      autoCalculateNextBillingDate: true,
    }), "2026-06-05T00:00:00.000Z", "2026-06-05T00:00:00.000Z");

    expect(row.custom_days).toBeNull();
    expect(row.custom_cycle_unit).toBeNull();
    expect(row.one_time_term_count).toBe(6);
    expect(row.one_time_term_unit).toBe("month");
    expect(row.auto_calculate_next_billing_date).toBe(0);
    expect(toApiSubscription(row)).toMatchObject({
      billingCycle: "one-time",
      oneTimeTermCount: 6,
      oneTimeTermUnit: "month",
      autoCalculateNextBillingDate: false,
    });
  });

  it("persists disabled reminder days through the API mapper", () => {
    const row = toSubscriptionRow("sub_quiet", "usr_custom", subscriptionBody({
      reminderDays: -2,
    }), "2026-06-05T00:00:00.000Z", "2026-06-05T00:00:00.000Z");

    expect(row.reminder_days).toBe(-2);
    expect(toApiSubscription(row)).toMatchObject({
      reminderDays: -2,
    });
  });

  it("clears one-time term fields for recurring subscriptions", () => {
    const row = toSubscriptionRow("sub_monthly", "usr_custom", subscriptionBody({
      billingCycle: "monthly",
      oneTimeTermCount: 6,
      oneTimeTermUnit: "month",
    }), "2026-06-05T00:00:00.000Z", "2026-06-05T00:00:00.000Z");

    const apiSubscription = toApiSubscription(row);

    expect(row.one_time_term_count).toBeNull();
    expect(row.one_time_term_unit).toBeNull();
    expect(apiSubscription).not.toHaveProperty("oneTimeTermCount");
    expect(apiSubscription).not.toHaveProperty("oneTimeTermUnit");
  });

  it("adds custom_cycle_unit through the standalone migration only", () => {
    const initialMigration = readFileSync(resolve("migrations/0001_initial.sql"), "utf8");
    const customUnitMigration = readFileSync(resolve("migrations/0007_subscription_custom_cycle_unit.sql"), "utf8");
    const oneTimeTermMigration = readFileSync(resolve("migrations/0008_subscription_one_time_term.sql"), "utf8");

    expect(initialMigration).not.toContain("custom_cycle_unit");
    expect(initialMigration).not.toContain("one_time_term");
    expect(customUnitMigration.trim()).toBe("ALTER TABLE subscriptions ADD COLUMN custom_cycle_unit TEXT;");
    expect(oneTimeTermMigration.trim()).toBe([
      "ALTER TABLE subscriptions ADD COLUMN one_time_term_count INTEGER;",
      "ALTER TABLE subscriptions ADD COLUMN one_time_term_unit TEXT;",
    ].join("\n"));
  });
});
