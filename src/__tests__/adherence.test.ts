import { describe, expect, it } from 'vitest'
import {
  formatAdherence,
  adherenceBadgeClass,
  adherenceAccentClass,
  showAdherenceScores,
} from '@/lib/adherence'

describe('formatAdherence', () => {
  it('rounds to a whole percent', () => {
    expect(formatAdherence(86.4)).toBe('86%')
    expect(formatAdherence(100)).toBe('100%')
    expect(formatAdherence(0)).toBe('0%')
  })

  it('renders an em dash for null/undefined', () => {
    expect(formatAdherence(null)).toBe('—')
    expect(formatAdherence(undefined)).toBe('—')
  })
})

describe('adherenceBadgeClass', () => {
  it('bands green / amber / red by score', () => {
    expect(adherenceBadgeClass(90)).toContain('emerald')
    expect(adherenceBadgeClass(70)).toContain('amber')
    expect(adherenceBadgeClass(40)).toContain('red')
  })

  it('is neutral when the score is null', () => {
    expect(adherenceBadgeClass(null)).toContain('muted')
  })
})

describe('adherenceAccentClass', () => {
  it('stripes by score band', () => {
    expect(adherenceAccentClass(90)).toContain('emerald')
    expect(adherenceAccentClass(70)).toContain('amber')
    expect(adherenceAccentClass(40)).toContain('red')
  })

  it('is empty when the score is null', () => {
    expect(adherenceAccentClass(null)).toBe('')
  })
})

describe('showAdherenceScores', () => {
  it('defaults to on when unset', () => {
    expect(showAdherenceScores(undefined)).toBe(true)
    expect(showAdherenceScores(null)).toBe(true)
    expect(showAdherenceScores({})).toBe(true)
  })

  it('respects an explicit false', () => {
    expect(showAdherenceScores({ show_adherence: false })).toBe(false)
    expect(showAdherenceScores({ show_adherence: true })).toBe(true)
  })
})
