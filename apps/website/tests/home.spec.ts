import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function expectLocalizedScreenshots(page: Page, suffix: 'zh' | 'en') {
  const otherSuffix = suffix === 'zh' ? 'en' : 'zh'
  const heroPicture = page.locator('[data-responsive-image="hero-dashboard"]')

  await expect(heroPicture.locator('source[type="image/avif"]')).toHaveAttribute(
    'srcset',
    new RegExp(`dashboard-${suffix}-2800\\.avif 2800w`),
  )
  await expect(heroPicture.locator('source[type="image/webp"]')).toHaveAttribute(
    'srcset',
    new RegExp(`dashboard-${suffix}-2800\\.webp 2800w`),
  )
  await expect(heroPicture.locator('img')).toHaveAttribute(
    'srcset',
    new RegExp(`dashboard-${suffix}-2x\\.png 2800w`),
  )

  const featureSources = await page.locator('[data-section="features"] source, [data-section="features"] img').evaluateAll(
    (nodes) =>
      nodes
        .map((node) => `${node.getAttribute('srcset') ?? ''} ${node.getAttribute('src') ?? ''}`.trim())
        .filter(Boolean),
  )

  for (const name of ['subscriptions', 'calendar', 'statistics', 'dashboard']) {
    expect(featureSources.some((value) => value.includes(`${name}-${suffix}`))).toBe(true)
    expect(featureSources.some((value) => value.includes(`${name}-${otherSuffix}`))).toBe(false)
  }

  expect(featureSources.some((value) => value.includes(`notifications-h5-${suffix}`))).toBe(true)
  expect(featureSources.some((value) => value.includes(`notifications-h5-${otherSuffix}`))).toBe(false)
}

test('renders the Renewlet homepage and opens deployment dialog from both entry points', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')

  await expect(page.getByRole('heading', { name: /别再让续费悄悄扣走预算/i })).toBeVisible()
  await expect(header.getByRole('link', { name: /^文档$/i })).toBeVisible()
  await expect(header.getByRole('link', { name: /^GitHub$/i })).toBeVisible()
  await expect(header.getByRole('button', { name: /Switch to English/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /选择部署方式/i })).toHaveCount(1)
  const footer = page.locator('[data-section="footer"]')
  await expect(footer.getByRole('link', { name: /^GitHub$/i })).toBeVisible()
  await expect(footer.getByRole('link', { name: /^Docker$/i })).toBeVisible()
  await expect(footer.getByRole('link', { name: /^Cloudflare$/i })).toBeVisible()
  await expect(footer.getByRole('link', { name: /^License$/i })).toBeVisible()
  await expect(footer.getByRole('link', { name: /中文 README|英文 README|MIT License/i })).toHaveCount(0)

  for (const card of ['subscriptions', 'reminders', 'calendar', 'statistics', 'hosting']) {
    await expect(page.locator(`[data-card="${card}"]`)).toBeVisible()
    await expect(page.locator(`[data-scene="${card}"]`)).toBeVisible()
  }
  await expect(page.locator('img[src*="/assets/cobalt/images/"]')).toHaveCount(0)

  await expectLocalizedScreenshots(page, 'zh')

  await expect(page.locator('[data-responsive-image="feature-screenshot"] source[type="image/avif"]')).toHaveCount(3)
  await expect(page.locator('[data-responsive-image="feature-phone"] source[type="image/avif"]')).toHaveCount(1)

  await page.getByRole('button', { name: /选择部署方式/i }).click()
  await expect(page.getByRole('heading', { name: /选择 Renewlet 部署方式/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Docker 单容器/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Cloudflare Workers/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /源码仓库/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /官网静态部署/i })).toHaveCount(0)
  await page.getByRole('button', { name: /关闭/i }).click()
  await expect(page.getByRole('heading', { name: /选择 Renewlet 部署方式/i })).not.toBeVisible()

  await page.getByRole('button', { name: /查看部署方式/i }).click()
  await expect(page.getByRole('heading', { name: /选择 Renewlet 部署方式/i })).toBeVisible()
})

test('switches the homepage copy to English', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')

  await header.getByRole('button', { name: /Switch to English/i }).click()

  await expect(
    page.getByRole('heading', { name: /Stop letting renewals quietly drain your budget/i }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Choose deployment/i })).toBeVisible()
  await expect(header.getByRole('link', { name: /^Docs$/i })).toBeVisible()
  await expect(header.getByRole('link', { name: /^GitHub$/i })).toBeVisible()
  await expectLocalizedScreenshots(page, 'en')
})

test('requests the Chinese retina hero candidate on high density screens', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  const requestedImages: string[] = []

  page.on('request', (request) => {
    if (request.resourceType() === 'image') {
      requestedImages.push(request.url())
    }
  })

  await page.goto('/')
  await expect(page.locator('[data-responsive-image="hero-dashboard"] img')).toBeVisible()
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-responsive-image="hero-dashboard"] img')
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.currentSrc.includes('dashboard-zh-2800')
    )
  })

  expect(requestedImages.some((url) => /dashboard-zh-2800\.(avif|webp)$/.test(url))).toBe(true)
  await context.close()
})

test('requests the English retina hero candidate after switching language on high density screens', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  const requestedImages: string[] = []

  page.on('request', (request) => {
    if (request.resourceType() === 'image') {
      requestedImages.push(request.url())
    }
  })

  await page.goto('/')
  await expect(page.locator('[data-responsive-image="hero-dashboard"] img')).toBeVisible()
  requestedImages.length = 0

  await page.getByRole('banner').getByRole('button', { name: /Switch to English/i }).click()
  await expect(page.locator('[data-responsive-image="hero-dashboard"] source[type="image/avif"]')).toHaveAttribute(
    'srcset',
    /dashboard-en-2800\.avif 2800w/,
  )
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-responsive-image="hero-dashboard"] img')
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.currentSrc.includes('dashboard-en-2800')
    )
  })

  expect(requestedImages.some((url) => /dashboard-en-2800\.(avif|webp)$/.test(url))).toBe(true)
  expect(requestedImages.some((url) => /dashboard-zh-2800\.(avif|webp)$/.test(url))).toBe(false)
  await context.close()
})
