import { describe, expect, it } from "vitest";
import { assertDateOnly } from "@/lib/time/date-only";
import { calculateNextBillingDate } from "./subscription-billing";

describe("subscription-billing", () => {
  it("calculates the next billing date by adding one cycle to the start date", () => {
    const startDate = assertDateOnly("2026-05-15");

    expect(calculateNextBillingDate(startDate, "weekly")).toBe("2026-05-22");
    expect(calculateNextBillingDate(startDate, "monthly")).toBe("2026-06-15");
    expect(calculateNextBillingDate(startDate, "quarterly")).toBe("2026-08-15");
    expect(calculateNextBillingDate(startDate, "semi-annual")).toBe("2026-11-15");
    expect(calculateNextBillingDate(startDate, "annual")).toBe("2027-05-15");
    expect(calculateNextBillingDate(startDate, "custom", 45)).toBe("2026-06-29");
  });

  it("uses 30 days for custom cycle previews when custom days are empty", () => {
    expect(calculateNextBillingDate(assertDateOnly("2026-05-15"), "custom")).toBe("2026-06-14");
  });

  it("follows Temporal date-only semantics for month-end and leap-year boundaries", () => {
    expect(calculateNextBillingDate(assertDateOnly("2026-01-31"), "monthly")).toBe("2026-02-28");
    expect(calculateNextBillingDate(assertDateOnly("2024-02-29"), "annual")).toBe("2025-02-28");
  });
});
