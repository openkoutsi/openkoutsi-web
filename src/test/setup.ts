import '@testing-library/jest-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { setAccessToken } from '@/lib/api'

// Provide a reliable localStorage implementation for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// jsdom implements no ResizeObserver, and Radix measures its thumb with one —
// so rendering a Switch (or anything else built on `useSize`) throws on mount
// rather than failing an assertion. A no-op is enough: nothing here asserts on
// layout, and the alternative is that no test may render a toggle.
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    writable: true,
  })
}

beforeEach(() => {
  // Reset the in-memory access token between tests
  setAccessToken(null)
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})
