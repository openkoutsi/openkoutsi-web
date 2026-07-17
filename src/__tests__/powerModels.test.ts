import { describe, it, expect } from 'vitest'
import {
  modelCurvePoints,
  predictionAt,
  MODEL_KEYS,
  MODEL_COLORS,
  DEFAULT_VISIBLE_MODELS,
  PROFILE_ROWS,
} from '@/components/charts/powerModels'
import { scaledX } from '@/components/charts/powerCurveScale'
import type { PowerModelFit } from '@/lib/types'

function fit(partial: Partial<PowerModelFit>): PowerModelFit {
  return {
    model: 'cp3',
    available: true,
    cp: null, w_prime: null, k: null, pmax: null, tau: null, a: null, b: null,
    rmse: null, curve: [], predictions: [],
    ...partial,
  }
}

describe('modelCurvePoints', () => {
  it('maps each curve duration onto the squared-log x scale', () => {
    const f = fit({
      curve: [
        { duration_s: 60, power_w: 400 },
        { duration_s: 300, power_w: 320 },
      ],
    })
    expect(modelCurvePoints(f)).toEqual([
      { x: scaledX(60), power_w: 400 },
      { x: scaledX(300), power_w: 320 },
    ])
  })

  it('returns an empty array for a model with no curve', () => {
    expect(modelCurvePoints(fit({ curve: [] }))).toEqual([])
  })
})

describe('predictionAt', () => {
  const f = fit({
    predictions: [
      { duration_s: 60, power_w: 450 },
      { duration_s: 300, power_w: 330 },
    ],
  })

  it('returns the predicted power for a known duration', () => {
    expect(predictionAt(f, 300)).toBe(330)
  })

  it('returns null when the model has no prediction at that duration', () => {
    expect(predictionAt(f, 5)).toBeNull()
  })
})

describe('model metadata', () => {
  it('has a colour for every model key', () => {
    for (const key of MODEL_KEYS) {
      expect(MODEL_COLORS[key]).toMatch(/^#/)
    }
  })

  it('defaults to visible models that are valid keys', () => {
    for (const key of DEFAULT_VISIBLE_MODELS) {
      expect(MODEL_KEYS).toContain(key)
    }
  })

  it('anchors profile rows to the expected durations', () => {
    expect(PROFILE_ROWS.map((r) => r.durationS)).toEqual([5, 60, 300, 1200])
  })
})
