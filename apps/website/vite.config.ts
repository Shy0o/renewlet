import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 只有 GitHub 仓库页需要 /renewlet/ base；Cloudflare Pages、自定义域和 Docker 静态站都走根路径。
const base = process.env.GITHUB_PAGES === 'true' ? '/renewlet/' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['tests/**', 'node_modules/**'],
  },
})
