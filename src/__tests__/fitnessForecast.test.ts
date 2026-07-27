import { describe, expect, it } from 'vitest'
import { MAX_FORECAST_DAYS, forecastHorizon } from '@/lib/fitnessForecast'

describe('forecastHorizon', () => {
  it('matches the period for periods shorter than the cap', () => {
    expect(forecastHorizon(7)).toBe(7)
    expect(forecastHorizon(30)).toBe(30)
    expect(forecastHorizon(90)).toBe(90)
  })

  it('caps longer periods at the maximum horizon', () => {
    expect(forecastHorizon(180)).toBe(MAX_FORECAST_DAYS)
    expect(forecastHorizon(365)).toBe(MAX_FORECAST_DAYS)
    expect(forecastHorizon(730)).toBe(MAX_FORECAST_DAYS)
    expect(forecastHorizon(1825)).toBe(MAX_FORECAST_DAYS)
  })

  it('never returns a negative horizon', () => {
    expect(forecastHorizon(0)).toBe(0)
    expect(forecastHorizon(-30)).toBe(0)
  })
})
