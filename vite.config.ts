import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { createSitemap } from './src/seo/sitemap.js'

export default defineConfig({
  plugins: [react(), {
    name: 'canonical-sitemap',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: createSitemap() })
    },
  }],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
  },
})
