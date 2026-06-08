import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatter } from "@lingui/format-po";

// Lingui catalog key 生成器：i18n extract 后运行，输出前端静态翻译 helper 可枚举的 key 类型。
// 副作用：重写 packages/client/src/i18n/catalog-keys.ts。
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalogDir = path.join(rootDir, "packages/client/src/i18n/catalogs");
const catalogKeysPath = path.join(rootDir, "packages/client/src/i18n/catalog-keys.ts");
const sourceLocale = "zh-CN";
const domains = [
  "common",
  "legal",
  "custom-config",
  "subscription",
  "auth",
  "settings",
  "public-status",
  "notification",
  "labels",
  "admin",
  "error",
];
const poFormatter = formatter({ origins: false });

function readCatalogFile(domain) {
  const filePath = path.join(catalogDir, sourceLocale, `${domain}.po`);
  const source = fs.readFileSync(filePath, "utf8");
  const parsed = poFormatter.parse(source, {
    locale: sourceLocale,
    sourceLocale,
    filename: filePath,
  });
  return Object.keys(parsed);
}

const keys = [...new Set(domains.flatMap(readCatalogFile))].sort();
const source = [
  "// 由 scripts/generate-i18n-catalog-keys.mjs 生成；MessageKey 是前端静态翻译 helper 的唯一 key union。",
  "export const MESSAGE_KEYS = [",
  ...keys.map((key) => `  ${JSON.stringify(key)},`),
  "] as const;",
  "",
  "export type MessageKey = (typeof MESSAGE_KEYS)[number];",
  "",
].join("\n");

fs.writeFileSync(catalogKeysPath, source);
console.log(`generated ${path.relative(rootDir, catalogKeysPath)} (${keys.length} keys).`);
