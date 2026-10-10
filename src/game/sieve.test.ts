import { describe, expect, it } from 'vitest'

import {
  baseDripRate,
  capacityMl,
  dribbleRate,
  NO_GEAR,
  offsetDegrees,
  sloshRate,
  tiltLimits,
  zoneOf
} from './sieve'

describe('sieve model', () => {
  it('holds 1.0, 1.5, 2.0 and 3.0 L', () => {
    expect(capacityMl(NO_GEAR)).toBe(1000)
    expect(capacityMl({ ...NO_GEAR, finerMesh: true })).toBe(1500)
    expect(capacityMl({ ...NO_GEAR, biggerSieve: true })).toBe(2000)
    expect(capacityMl({ ...NO_GEAR, finerMesh: true, biggerSieve: true })).toBe(
      3000
    )
  })

  it('drips 0.8% per second, and wax cuts it to 0.28%', () => {
    expect(baseDripRate(1000, NO_GEAR)).toBeCloseTo(8)
    expect(baseDripRate(1000, { ...NO_GEAR, wax: true })).toBeCloseTo(2.8)
  })

  it('sloshes nothing in the green zone and a quarter per second at the limit', () => {
    expect(sloshRate(1000, 0.55, NO_GEAR)).toBe(0)
    expect(sloshRate(1000, 1, NO_GEAR)).toBeCloseTo(250)
    expect(sloshRate(1000, 1, { ...NO_GEAR, wax: true })).toBeCloseTo(87.5)
  })

  it('dribbles past 12 degrees and tips at 30, or 18 and 45 in Assist Mode', () => {
    expect(dribbleRate(1000, 12, false)).toBe(0)
    expect(dribbleRate(1000, 21, false)).toBeCloseTo(75)
    expect(dribbleRate(1000, 30, false)).toBeCloseTo(300)
    expect(tiltLimits(false)).toEqual({ dribble: 12, tip: 30 })
    expect(tiltLimits(true)).toEqual({ dribble: 18, tip: 45 })
    expect(dribbleRate(1000, 15, true)).toBe(0)
  })

  it('maps 100 units of offset to 30 degrees', () => {
    expect(offsetDegrees(60, 80)).toBeCloseTo(30)
  })

  it('names zones at 0.55 and 1.0', () => {
    expect(zoneOf(0.5)).toBe('green')
    expect(zoneOf(0.7)).toBe('slosh')
    expect(zoneOf(1)).toBe('break')
  })
})
