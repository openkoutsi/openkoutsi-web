import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vitest 4 bundles rolldown-vite (oxc transform). The repo's tsconfig sets
  // `jsx: preserve` (required by Next.js), which oxc would otherwise inherit and
  // leave `.tsx` JSX untransformed. Force the automatic React runtime for tests.
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'react' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      exclude: ['src/lib/types.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
