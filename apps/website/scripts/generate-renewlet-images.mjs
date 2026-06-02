import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const currentFile = fileURLToPath(import.meta.url)
const websiteDir = path.resolve(path.dirname(currentFile), '..')
const repoDir = path.resolve(websiteDir, '..', '..')
const serverDir = path.join(repoDir, 'packages', 'server')
const clientDir = path.join(repoDir, 'packages', 'client')
const outputDir = path.join(websiteDir, 'public', 'assets', 'renewlet', 'images')
const tmpDir = path.join(repoDir, '.tmp', 'website-retina')
const serverPort = 43291
const clientPort = 45274
const serverURL = `http://127.0.0.1:${serverPort}`
const clientURL = `http://127.0.0.1:${clientPort}`
const adminEmail = 'website-screenshots@example.com'
const adminPassword = 'password123'

// 官网截图必须来自真实 Renewlet UI；这里同时固定浏览器语言、产品语言和等待文案。
const captureLocales = [
  {
    suffix: 'zh',
    appLocale: 'zh-CN',
    browserLocale: 'zh-CN',
    login: { email: '邮箱', password: '密码', submit: '登录' },
    desktop: [
      { key: 'dashboard', path: '/', waitFor: '月度支出' },
      { key: 'subscriptions', path: '/subscriptions', waitFor: '订阅列表' },
      { key: 'calendar', path: '/calendar', waitFor: '续费日历' },
      { key: 'statistics', path: '/statistics', waitFor: '统计分析' },
      { key: 'notifications', path: '/settings', waitFor: '通知设置' },
    ],
    mobile: [
      { key: 'notifications-h5', path: '/settings', waitFor: '通知设置' },
    ],
    tags: {
      design: ['团队', '设计'],
      project: ['项目管理'],
      testing: ['测试'],
      ci: ['CI'],
      browser: ['浏览器'],
      automation: ['自动化'],
      docs: ['知识库'],
    },
  },
  {
    suffix: 'en',
    appLocale: 'en-US',
    browserLocale: 'en-US',
    login: { email: 'Email', password: 'Password', submit: 'Log in' },
    desktop: [
      { key: 'dashboard', path: '/', waitFor: 'Monthly spend' },
      { key: 'subscriptions', path: '/subscriptions', waitFor: 'Subscriptions' },
      { key: 'calendar', path: '/calendar', waitFor: 'Renewal calendar' },
      { key: 'statistics', path: '/statistics', waitFor: 'Statistics' },
      { key: 'notifications', path: '/settings', waitFor: 'Notifications' },
    ],
    mobile: [
      { key: 'notifications-h5', path: '/settings', waitFor: 'Notifications' },
    ],
    tags: {
      design: ['Team', 'Design'],
      project: ['Project'],
      testing: ['Testing'],
      ci: ['CI'],
      browser: ['Browser'],
      automation: ['Automation'],
      docs: ['Docs'],
    },
  },
]

function settingsForLocale(locale) {
  return {
    adminUsername: 'Admin',
    themeMode: 'dark',
    themeVariant: 'emerald',
    themeCustomColor: { h: 160, s: 84, l: 39 },
    locale,
    showExpired: true,
    defaultCurrency: 'CNY',
    exchangeRateProvider: 'floatrates',
    builtInIconSources: {
      thesvg: { enabled: true, variantsEnabled: true },
      selfhst: { enabled: true, variantsEnabled: true },
      dashboardIcons: { enabled: true, variantsEnabled: true },
    },
    monthlyBudget: 1500,
    timezone: 'Asia/Shanghai',
    notificationTimeLocal: '08:30',
    notificationReminderDays: 3,
    enabledChannels: ['email'],
    testPhone: '',
    telegramBotToken: '',
    telegramChatId: '',
    notifyxApiKey: '',
    webhookUrl: '',
    webhookMethod: 'POST',
    webhookHeaders: '',
    webhookPayload: '',
    wechatWebhookUrl: '',
    wechatMessageType: 'text',
    wechatAddModeTag: false,
    wechatAtPhones: '',
    wechatAtAll: false,
    smtpHost: 'smtp.example.com',
    smtpPort: '587',
    smtpSecure: false,
    smtpUser: 'renewlet',
    smtpPassword: '••••••••••••',
    smtpFrom: 'Renewlet <notify@example.com>',
    smtpReplyTo: 'ops@example.com',
    notifyMultipleAddresses: true,
    recipientEmail: 'ops@example.com, finance@example.com',
    barkServerUrl: 'https://api.day.app',
    barkDeviceKey: '',
    barkSilentPush: false,
  }
}

// seed 数据只服务官网截图稳定性，tags 分语言替换，避免英文官网继续露出中文标签。
function subscriptionRows(tags) {
  return [
    ['Linear Business', 115, 'USD', 'monthly', 'developer_tools', 'active', 'credit_card', '2026-01-12', '2026-06-12', tags.design],
    ['Linear Basic', 8, 'USD', 'monthly', 'developer_tools', 'active', 'paypal', '2026-02-03', '2026-06-03', tags.project],
    ['TestRail Professional', 37, 'USD', 'monthly', 'developer_tools', 'trial', 'credit_card', '2026-05-19', '2026-06-19', tags.testing],
    ['Cypress Cloud Team', 75, 'USD', 'monthly', 'developer_tools', 'active', 'paypal', '2026-03-08', '2026-06-08', tags.ci],
    ['LambdaTest Live', 19, 'USD', 'monthly', 'developer_tools', 'active', 'paypal', '2026-04-17', '2026-06-17', tags.browser],
    ['Sauce Labs Live Test', 39, 'USD', 'monthly', 'developer_tools', 'paused', 'credit_card', '2026-01-24', '2026-07-24', tags.testing],
    ['BrowserStack Automate', 169, 'USD', 'monthly', 'developer_tools', 'active', 'credit_card', '2026-01-30', '2026-06-30', tags.automation],
    ['Notion Plus', 10, 'USD', 'monthly', 'productivity', 'active', 'apple_pay', '2026-02-14', '2026-06-14', tags.docs],
  ]
}

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    env: {
      ...process.env,
      NO_PROXY: ['127.0.0.1', 'localhost', '::1', process.env.NO_PROXY].filter(Boolean).join(','),
      no_proxy: ['127.0.0.1', 'localhost', '::1', process.env.no_proxy].filter(Boolean).join(','),
      ...(options.env ?? {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  child.stdout.on('data', (chunk) => process.stdout.write(`[${options.name}] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[${options.name}] ${chunk}`))
  child.on('exit', (code) => {
    if (code && code !== 0) process.stderr.write(`[${options.name}] exited with code ${code}\n`)
  })
  return child
}

async function stopProcess(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      return
    }
  }
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_500)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      child.kill('SIGKILL')
    }
  }
}

async function waitForURL(url, label) {
  const deadline = Date.now() + 120_000
  let lastError = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = `${response.status} ${response.statusText}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError}`)
}

async function jsonFetch(url, init = {}) {
  const acceptLanguage = init.acceptLanguage ?? 'zh-CN'
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'accept-language': acceptLanguage,
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

async function createAdmin() {
  const localeConfig = captureLocales[0]
  await jsonFetch(`${serverURL}/api/app/setup`, {
    method: 'POST',
    acceptLanguage: localeConfig.appLocale,
    body: JSON.stringify({ name: 'Admin', email: adminEmail, password: adminPassword }),
  })
  return login(localeConfig)
}

async function login(localeConfig) {
  const auth = await jsonFetch(`${serverURL}/api/collections/users/auth-with-password`, {
    method: 'POST',
    acceptLanguage: localeConfig.appLocale,
    body: JSON.stringify({ identity: adminEmail, password: adminPassword }),
  })
  return { token: auth.token, userId: auth.record.id }
}

async function seedInitialData(localeConfig, auth) {
  await jsonFetch(`${serverURL}/api/collections/settings/records`, {
    method: 'POST',
    acceptLanguage: localeConfig.appLocale,
    headers: { Authorization: auth.token },
    body: JSON.stringify({ user: auth.userId, settings: settingsForLocale(localeConfig.appLocale) }),
  })

  for (const [name, price, currency, billingCycle, category, status, paymentMethod, startDate, nextBillingDate, tags] of subscriptionRows(localeConfig.tags)) {
    await jsonFetch(`${serverURL}/api/collections/subscriptions/records`, {
      method: 'POST',
      acceptLanguage: localeConfig.appLocale,
      headers: { Authorization: auth.token },
      body: JSON.stringify({
        user: auth.userId,
        name,
        logo: '',
        price,
        currency,
        billingCycle,
        customDays: null,
        category,
        status,
        paymentMethod,
        startDate,
        nextBillingDate,
        autoCalculateNextBillingDate: true,
        trialEndDate: null,
        website: null,
        notes: null,
        tags,
        reminderDays: 3,
        repeatReminderEnabled: name === 'BrowserStack Automate',
        repeatReminderInterval: '6h',
        repeatReminderWindow: '72h',
        extra: { seed: 'website-screenshot' },
      }),
    })
  }
}

async function updateLocaleData(localeConfig, auth) {
  const settingsList = await jsonFetch(`${serverURL}/api/collections/settings/records?filter=${encodeURIComponent(`user = "${auth.userId}"`)}&perPage=1`, {
    acceptLanguage: localeConfig.appLocale,
    headers: { Authorization: auth.token },
  })
  const settingsRecord = settingsList.items?.[0]
  if (settingsRecord) {
    await jsonFetch(`${serverURL}/api/collections/settings/records/${settingsRecord.id}`, {
      method: 'PATCH',
      acceptLanguage: localeConfig.appLocale,
      headers: { Authorization: auth.token },
      body: JSON.stringify({ settings: settingsForLocale(localeConfig.appLocale) }),
    })
  }

  const list = await jsonFetch(`${serverURL}/api/collections/subscriptions/records?filter=${encodeURIComponent(`user = "${auth.userId}"`)}&perPage=100&sort=created`, {
    acceptLanguage: localeConfig.appLocale,
    headers: { Authorization: auth.token },
  })
  const nextRows = subscriptionRows(localeConfig.tags)
  for (const [index, record] of (list.items ?? []).entries()) {
    const row = nextRows[index]
    if (!row) continue
    await jsonFetch(`${serverURL}/api/collections/subscriptions/records/${record.id}`, {
      method: 'PATCH',
      acceptLanguage: localeConfig.appLocale,
      headers: { Authorization: auth.token },
      body: JSON.stringify({ tags: row[9] }),
    })
  }
}

async function createBrowserContext(browser, viewport, localeConfig) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    locale: localeConfig.browserLocale,
    timezoneId: 'Asia/Shanghai',
  })
  const page = await context.newPage()
  await page.goto(`${clientURL}/login`)
  await page.getByLabel(localeConfig.login.email, { exact: true }).fill(adminEmail)
  await page.getByLabel(localeConfig.login.password, { exact: true }).fill(adminPassword)
  await page.getByRole('button', { name: localeConfig.login.submit }).click()
  await page.waitForURL(`${clientURL}/`)
  await page.waitForLoadState('networkidle')
  return { context, page }
}

// 先保存 2x 原始截图，再交给 Sharp 生成压缩候选；原始源图不应该留在 public 目录。
async function capture(page, item, viewport, localeConfig) {
  await page.goto(`${clientURL}${item.path}`)
  await page.waitForLoadState('networkidle')
  await page.getByText(item.waitFor).first().waitFor({ state: 'visible', timeout: 20_000 })
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(600)
  await page.screenshot({
    path: path.join(outputDir, `${item.key}-${localeConfig.suffix}-${viewport.width * 2}.png`),
    fullPage: false,
  })
}

async function renderVariants(name, width, height) {
  const source = path.join(outputDir, `${name}-${width * 2}.png`)
  // PNG 只做 fallback；现代浏览器优先用 AVIF/WebP，避免 Retina 截图拖慢首屏。
  const variants = [
    { file: `${name}.png`, width, format: 'png' },
    { file: `${name}-2x.png`, width: width * 2, format: 'png' },
    { file: `${name}-${width}.webp`, width, format: 'webp' },
    { file: `${name}-${width * 2}.webp`, width: width * 2, format: 'webp' },
    { file: `${name}-${width}.avif`, width, format: 'avif' },
    { file: `${name}-${width * 2}.avif`, width: width * 2, format: 'avif' },
  ]
  for (const variant of variants) {
    let pipeline = sharp(source)
    if (variant.width !== width * 2) {
      pipeline = pipeline.resize({ width: variant.width, height: Math.round(height * (variant.width / width)), fit: 'cover' })
    }
    if (variant.format === 'png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
    if (variant.format === 'webp') pipeline = pipeline.webp({ quality: 82 })
    if (variant.format === 'avif') pipeline = pipeline.avif({ quality: 58, effort: 6 })
    await pipeline.toFile(path.join(outputDir, variant.file))
  }
  await rm(source, { force: true })
}

async function main() {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(tmpDir, { recursive: true })
  await mkdir(outputDir, { recursive: true })

  const server = startProcess('go', ['run', './cmd/renewlet', 'serve', `--http=127.0.0.1:${serverPort}`, `--dir=${path.join(tmpDir, 'pb_data')}`], {
    cwd: serverDir,
    name: 'server',
    env: { SETUP_ENABLED: 'true', GOMEMLIMIT: '128MiB' },
  })
  const client = startProcess('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', String(clientPort), '--strictPort'], {
    cwd: clientDir,
    name: 'client',
    env: { VITE_DEV_PROXY_TARGET: serverURL },
  })

  try {
    await waitForURL(`${serverURL}/api/app/health`, 'server')
    await waitForURL(clientURL, 'client')
    const auth = await createAdmin()
    await seedInitialData(captureLocales[0], auth)

    const browser = await chromium.launch()
    try {
      for (const localeConfig of captureLocales) {
        await updateLocaleData(localeConfig, auth)

        const desktop = await createBrowserContext(browser, { width: 1400, height: 900 }, localeConfig)
        for (const item of localeConfig.desktop) {
          await capture(desktop.page, item, { width: 1400, height: 900 }, localeConfig)
        }
        await desktop.context.close()

        const mobile = await createBrowserContext(browser, { width: 430, height: 932 }, localeConfig)
        for (const item of localeConfig.mobile) {
          await capture(mobile.page, item, { width: 430, height: 932 }, localeConfig)
        }
        await mobile.context.close()
      }
    } finally {
      await browser.close()
    }

    for (const localeConfig of captureLocales) {
      for (const item of localeConfig.desktop) {
        await renderVariants(`${item.key}-${localeConfig.suffix}`, 1400, 900)
      }
      for (const item of localeConfig.mobile) {
        await renderVariants(`${item.key}-${localeConfig.suffix}`, 430, 932)
      }
    }
  } finally {
    await Promise.all([stopProcess(server), stopProcess(client)])
  }
}

await main()
