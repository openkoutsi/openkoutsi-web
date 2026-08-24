/**
 * Reload the current document.
 *
 * A one-line indirection so that callers can be tested: jsdom's `location` is
 * not configurable, and stubbing `window.location.reload` in place is fragile
 * across environments. Mocking this module is not.
 */
export function reloadPage() {
  if (typeof window === 'undefined') return
  window.location.reload()
}
