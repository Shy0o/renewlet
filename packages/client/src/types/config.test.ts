import { describe, expect, it } from "vitest";
import { CATEGORIES } from "./subscription";
import { getDefaultCategories, normalizeCategories, type ConfigItem } from "./config";

const legacyCategory = (value: string): ConfigItem => ({
  id: value,
  value,
  labels: {
    "zh-CN": `自定义 ${value}`,
    "en-US": `Custom ${value}`,
  },
  color: `custom-${value}`,
});

describe("category config defaults", () => {
  it("defines the expanded built-in category set with labels and colors", () => {
    const categories = getDefaultCategories();

    expect(CATEGORIES).toHaveLength(23);
    expect(categories.map((category) => category.value)).toEqual([...CATEGORIES]);
    for (const category of categories) {
      expect(category.id).toBe(category.value);
      expect(category.labels["zh-CN"]).toBeTruthy();
      expect(category.labels["en-US"]).toBeTruthy();
      expect(category.color).toMatch(/^hsl\(.+\)$/);
    }
  });

  it("appends new defaults to the legacy four-category config without rewriting existing items", () => {
    const legacyItems = [
      legacyCategory("finance"),
      legacyCategory("productivity"),
      legacyCategory("lifestyle"),
      legacyCategory("entertainment"),
    ];

    const normalized = normalizeCategories(legacyItems);

    expect(normalized).toHaveLength(23);
    expect(normalized.slice(0, legacyItems.length)).toEqual(legacyItems);
    expect(normalized.map((category) => category.value)).toEqual([
      "finance",
      "productivity",
      "lifestyle",
      "entertainment",
      ...CATEGORIES.filter((value) => !legacyItems.some((item) => item.value === value)),
    ]);
  });

  it("does not append built-in categories to a customized category list", () => {
    const customItems = [
      legacyCategory("productivity"),
      legacyCategory("entertainment"),
      legacyCategory("lifestyle"),
      legacyCategory("personal"),
    ];

    expect(normalizeCategories(customItems)).toEqual(customItems);
  });
});
