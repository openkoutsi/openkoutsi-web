import type { Zone } from '@/lib/types'

// The zone model is fixed (issue #38): seven power zones, five HR zones, with
// these names. The three-band intensity mapping reads zones by position, so a
// variable-length list would silently change what a zone means.
export const HR_ZONE_COUNT = 5
export const POWER_ZONE_COUNT = 7

export const HR_ZONE_NAMES = [
  'Z1 Recovery',
  'Z2 Endurance',
  'Z3 Tempo',
  'Z4 Threshold',
  'Z5 VO2max',
]

export const POWER_ZONE_NAMES = [
  'Z1 Recovery',
  'Z2 Endurance',
  'Z3 Tempo',
  'Z4 Threshold',
  'Z5 VO2max',
  'Z6 Anaerobic',
  'Z7 Neuromuscular',
]

export function defaultHrZones(maxHr: number): Zone[] {
  return [
    { name: 'Z1 Recovery',   low: Math.round(maxHr * 0.50), high: Math.round(maxHr * 0.60) },
    { name: 'Z2 Endurance',  low: Math.round(maxHr * 0.60), high: Math.round(maxHr * 0.70) },
    { name: 'Z3 Tempo',      low: Math.round(maxHr * 0.70), high: Math.round(maxHr * 0.80) },
    { name: 'Z4 Threshold',  low: Math.round(maxHr * 0.80), high: Math.round(maxHr * 0.90) },
    { name: 'Z5 VO2max',     low: Math.round(maxHr * 0.90), high: maxHr },
  ]
}

export function defaultPowerZones(ftp: number): Zone[] {
  return [
    { name: 'Z1 Recovery',      low: 0,                       high: Math.round(ftp * 0.55) },
    { name: 'Z2 Endurance',     low: Math.round(ftp * 0.55),  high: Math.round(ftp * 0.75) },
    { name: 'Z3 Tempo',         low: Math.round(ftp * 0.75),  high: Math.round(ftp * 0.87) },
    { name: 'Z4 Threshold',     low: Math.round(ftp * 0.87),  high: Math.round(ftp * 0.95) },
    { name: 'Z5 VO2max',        low: Math.round(ftp * 0.95),  high: Math.round(ftp * 1.06) },
    { name: 'Z6 Anaerobic',     low: Math.round(ftp * 1.06),  high: Math.round(ftp * 1.20) },
    { name: 'Z7 Neuromuscular', low: Math.round(ftp * 1.20),  high: 9999 },
  ]
}
