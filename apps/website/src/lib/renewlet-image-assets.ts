import manifest from '../content/renewlet-image-manifest.json' with { type: 'json' }

export type ScreenshotLocale = 'zh' | 'en'
export type ScreenshotKey = (typeof manifest.captures)[number]['key']
export type ScreenshotViewport = keyof typeof manifest.viewports
export type ScreenshotSizeKey = keyof typeof manifest.sizes

export type ScreenshotAsset = {
  avif: string
  fallback: string
  height: number
  png: string
  sizes: string
  webp: string
  width: number
}

export const renewletImageManifest = manifest

export function imageSuffix(locale: ScreenshotLocale) {
  return locale === 'en' ? 'en' : 'zh'
}

export function screenshotName(key: ScreenshotKey, locale: ScreenshotLocale) {
  return `${key}-${imageSuffix(locale)}`
}

export function screenshotViewport(key: ScreenshotKey) {
  const capture = manifest.captures.find((item) => item.key === key)
  if (!capture) throw new Error(`Unknown Renewlet screenshot key: ${key}`)
  return manifest.viewports[capture.viewport as ScreenshotViewport]
}

function assetBasePath() {
  return `${import.meta.env.BASE_URL}${manifest.assetBase}`
}

function viewportForName(name: string) {
  const capture = manifest.captures.find((item) => name.startsWith(`${item.key}-`))
  if (!capture) throw new Error(`Unknown Renewlet screenshot asset: ${name}`)
  return manifest.viewports[capture.viewport as ScreenshotViewport]
}

// 响应式命名契约由 manifest 和截图脚本共同维护；组件只负责把候选交给浏览器选择。
export function responsiveScreenshotAsset(
  name: string,
  sizesKey: ScreenshotSizeKey = 'featureDesktop',
): ScreenshotAsset {
  const viewport = viewportForName(name)
  const base = assetBasePath()
  const [width, retinaWidth] = viewport.websiteWidths

  return {
    avif: `${base}${name}-${width}.avif ${width}w, ${base}${name}-${retinaWidth}.avif ${retinaWidth}w`,
    webp: `${base}${name}-${width}.webp ${width}w, ${base}${name}-${retinaWidth}.webp ${retinaWidth}w`,
    png: `${base}${name}.png ${width}w, ${base}${name}-2x.png ${retinaWidth}w`,
    fallback: `${base}${name}.png`,
    width: viewport.width,
    height: viewport.height,
    sizes: manifest.sizes[sizesKey],
  }
}
