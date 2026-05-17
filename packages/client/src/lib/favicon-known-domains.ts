/**
 * 常见关键词 → 域名映射（用于更准确地获取站点 favicon/logo）。
 *
 * 背景：
 * - LogoPicker / IconPicker / 服务端 `/api/app/favicon-search` 都需要“根据关键词猜测域名”
 * - 之前这些映射散落在多个组件里，容易出现“不一致/漏改”
 *
 * 说明：
 * - 这里只维护“命中率最高”的常见映射；未命中时会走 `fallbackTlds` 猜测
 * - key 一律使用小写、去空格后的关键词（与 `generateFaviconUrls` 的 normalize 逻辑保持一致）
 */

/** 常见订阅服务关键词 → 域名映射（偏订阅产品）。 */
export const SERVICE_DOMAINS: Readonly<Record<string, string>> = {
  netflix: "netflix.com",
  spotify: "spotify.com",
  youtube: "youtube.com",
  github: "github.com",
  notion: "notion.so",
  figma: "figma.com",
  slack: "slack.com",
  discord: "discord.com",
  dropbox: "dropbox.com",
  adobe: "adobe.com",
  microsoft: "microsoft.com",
  google: "google.com",
  amazon: "amazon.com",
  apple: "apple.com",
  twitter: "twitter.com",
  linkedin: "linkedin.com",
  zoom: "zoom.us",
  openai: "openai.com",
  chatgpt: "openai.com",
  copilot: "github.com",
  cursor: "cursor.sh",
  vercel: "vercel.com",
  railway: "railway.app",
  heroku: "heroku.com",
  digitalocean: "digitalocean.com",
  aws: "aws.amazon.com",
  cloudflare: "cloudflare.com",
  stripe: "stripe.com",
  paypal: "paypal.com",
  twitch: "twitch.tv",
  hulu: "hulu.com",
  disney: "disneyplus.com",
  hbo: "hbomax.com",
  paramount: "paramountplus.com",
  peacock: "peacocktv.com",
  crunchyroll: "crunchyroll.com",
  bilibili: "bilibili.com",
  iqiyi: "iqiyi.com",
  youku: "youku.com",
  tencent: "qq.com",
  weixin: "weixin.qq.com",
  alipay: "alipay.com",
  jd: "jd.com",
  taobao: "taobao.com",
  meituan: "meituan.com",
  didi: "didiglobal.com",
  baidu: "baidu.com",
  bytedance: "bytedance.com",
  douyin: "douyin.com",
  tiktok: "tiktok.com",
};

/** 常见支付/金融关键词 → 域名映射（偏支付方式 icon）。 */
export const PAYMENT_DOMAINS: Readonly<Record<string, string>> = {
  alipay: "alipay.com",
  wechat: "weixin.qq.com",
  weixin: "weixin.qq.com",
  credit: "visa.com",
  visa: "visa.com",
  mastercard: "mastercard.com",
  paypal: "paypal.com",
  apple: "apple.com",
  google: "google.com",
  stripe: "stripe.com",
  bank: "chase.com",
  crypto: "bitcoin.org",
  bitcoin: "bitcoin.org",
  ethereum: "ethereum.org",
  usdt: "tether.to",
};

/** 服务端/客户端统一使用的“已知关键词域名映射”。 */
export const KNOWN_FAVICON_DOMAINS: Readonly<Record<string, string>> = {
  ...SERVICE_DOMAINS,
  ...PAYMENT_DOMAINS,
};
