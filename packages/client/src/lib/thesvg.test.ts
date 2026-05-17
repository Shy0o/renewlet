import { describe, expect, it } from "vitest";
import {
  buildTheSvgIconUrl,
  createTheSvgIndex,
  parseTheSvgRegistry,
  searchTheSvgIcons,
  THE_SVG_CDN_BASE,
} from "./thesvg";

describe("theSVG helpers", () => {
  const rawRegistry = [
    {
      slug: "netflix",
      title: "Netflix",
      aliases: ["Netflix Streaming"],
      categories: ["Entertainment", "Platform"],
      variants: {
        default: "/icons/netflix/default.svg",
        mono: "/icons/netflix/mono.svg",
      },
      hex: "E50914",
      license: "CC0-1.0",
      url: "https://www.netflix.com",
      guidelines: "https://brand.netflix.com/en/assets/logos",
    },
    {
      slug: "notion",
      title: "Notion",
      aliases: [],
      categories: ["Productivity"],
      variants: {
        color: "/icons/notion/color.svg",
      },
      license: "MIT",
    },
    {
      slug: "bad",
      title: "Bad",
      variants: {
        "../escape": "/icons/bad/default.svg",
        default: "/other/default.svg",
      },
    },
  ];

  it("parses registry entries and filters invalid variants", () => {
    const icons = parseTheSvgRegistry(rawRegistry);

    expect(icons.map((icon) => icon.slug)).toEqual(["netflix", "notion"]);
    expect(icons[0]?.variants["default"]).toBe("/icons/netflix/default.svg");
  });

  it("builds fixed jsDelivr CDN URLs via testingcf.jsdelivr.net", () => {
    expect(buildTheSvgIconUrl("netflix", "default")).toBe(
      `${THE_SVG_CDN_BASE}/public/icons/netflix/default.svg`,
    );
  });

  it("ranks exact brand matches first", () => {
    const icons = parseTheSvgRegistry(rawRegistry);
    const results = searchTheSvgIcons(icons, "netflix");

    expect(results[0]).toMatchObject({
      slug: "netflix",
      title: "Netflix",
      iconUrl: `${THE_SVG_CDN_BASE}/public/icons/netflix/default.svg`,
    });
  });

  it("searches compact local index entries without registry variants", () => {
    const index = createTheSvgIndex(parseTheSvgRegistry(rawRegistry));
    const results = searchTheSvgIcons(index, "notion");

    expect(index[0]).not.toHaveProperty("variants");
    expect(results[0]).toMatchObject({
      slug: "notion",
      title: "Notion",
      iconUrl: `${THE_SVG_CDN_BASE}/public/icons/notion/color.svg`,
    });
  });
});
