import { describe, expect, it } from "vitest";
import {
  publicStatusPageCreateResponseSchema,
  publicStatusResponseSchema,
} from "./public-status";
import { appSettingsSchema } from "./settings";

describe("public status schemas", () => {
  it("accepts minimal public status rows without prices", () => {
    expect(publicStatusResponseSchema.parse({
      page: {
        title: "Renewlet",
        showPrices: false,
        generatedAt: "2026-06-07T00:00:00.000Z",
        truncated: false,
      },
      subscriptions: [{
        name: "Netflix",
        logo: "https://example.com/netflix.png",
        category: { value: "streaming", label: "Streaming", color: "#ef4444" },
        status: "active",
        startDate: "2026-01-01",
        nextBillingDate: "2026-07-01",
        updatedAt: "2026-06-07T00:00:00.000Z",
      }],
    }).subscriptions[0]?.price).toBeUndefined();
  });

  it("requires price and currency to be exposed together", () => {
    expect(publicStatusResponseSchema.safeParse({
      page: {
        title: "Renewlet",
        showPrices: true,
        currency: "USD",
        generatedAt: "2026-06-07T00:00:00.000Z",
        truncated: false,
      },
      subscriptions: [{
        name: "Netflix",
        category: { value: "streaming", label: "Streaming" },
        status: "active",
        startDate: "2026-01-01",
        nextBillingDate: "2026-07-01",
        updatedAt: "2026-06-07T00:00:00.000Z",
        price: 9.99,
      }],
    }).success).toBe(false);
  });

  it("requires public page currency and billing cycle only when prices are visible", () => {
    expect(publicStatusResponseSchema.safeParse({
      page: {
        title: "Renewlet",
        showPrices: true,
        currency: "USD",
        generatedAt: "2026-06-07T00:00:00.000Z",
        truncated: false,
      },
      subscriptions: [{
        name: "Annual Plan",
        category: { value: "streaming", label: "Streaming" },
        status: "active",
        startDate: "2026-01-01",
        nextBillingDate: "2026-07-01",
        updatedAt: "2026-06-07T00:00:00.000Z",
        price: 120,
        currency: "USD",
        billingCycle: "annual",
      }],
    }).success).toBe(true);

    expect(publicStatusResponseSchema.safeParse({
      page: {
        title: "Renewlet",
        showPrices: false,
        currency: "USD",
        generatedAt: "2026-06-07T00:00:00.000Z",
        truncated: false,
      },
      subscriptions: [],
    }).success).toBe(false);
  });

  it("accepts inherited or explicit public status currency settings", () => {
    expect(appSettingsSchema.pick({ publicStatusCurrency: true }).parse({ publicStatusCurrency: "inherit" }).publicStatusCurrency).toBe("inherit");
    expect(appSettingsSchema.pick({ publicStatusCurrency: true }).parse({ publicStatusCurrency: "USD" }).publicStatusCurrency).toBe("USD");
    expect(appSettingsSchema.pick({ publicStatusCurrency: true }).safeParse({ publicStatusCurrency: "usd" }).success).toBe(false);
  });

  it("keeps management create responses on bearer URL shape", () => {
    expect(publicStatusPageCreateResponseSchema.safeParse({
      publicStatusPage: {
        enabled: true,
        createdAt: "2026-06-07T00:00:00.000Z",
        updatedAt: "2026-06-07T00:00:00.000Z",
        pageUrl: "https://renewlet.example/status/abc123abc123abc123abc123abc123abc123abc123a",
        showPrices: false,
      },
    }).success).toBe(true);
  });
});
