import { describe, it, expect } from 'vitest'
import { pointWkg } from '@/components/charts/PowerCurveChart'

describe('pointWkg', () => {
  it('prefers the backend-provided w_per_kg', () => {
    // Even if a local divide would differ, the backend ranking value wins.
    expect(pointWkg({ power_w: 300, weight_kg: 60, w_per_kg: 4.62 })).toBe(4.62)
  })

  it('falls back to power_w / weight_kg when w_per_kg is absent', () => {
    expect(pointWkg({ power_w: 300, weight_kg: 75, w_per_kg: null })).toBeCloseTo(4.0, 5)
  })

  it('returns null when there is no usable weight', () => {
    expect(pointWkg({ power_w: 300, weight_kg: null, w_per_kg: null })).toBeNull()
    expect(pointWkg({ power_w: 300, weight_kg: 0, w_per_kg: null })).toBeNull()
  })
})
