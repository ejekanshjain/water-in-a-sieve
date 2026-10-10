import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { createDrift, driftAmplitude, fatigueFor, stepDrift } from './drift'

/** Largest drift distance from the centre over `seconds` at `speed`. */
function maxDrift(speed: number, carrySeconds: number, scale = 1, seed = 3) {
  const drift = createDrift(rng(seed))
  let max = 0
  for (let t = 0; t < 30_000; t += 1000 / 60) {
    stepDrift(drift, 1000 / 60, speed, carrySeconds, scale)
    max = Math.max(max, Math.hypot(drift.x, drift.y))
  }
  return max
}

describe('drift', () => {
  it('grows with speed and with arm fatigue', () => {
    expect(driftAmplitude(5, 1)).toBe(60)
    expect(driftAmplitude(8, 1)).toBe(84)
    expect(maxDrift(8, 0)).toBeGreaterThan(maxDrift(2, 0))
    expect(maxDrift(4, 35)).toBeGreaterThan(maxDrift(4, 0) * 1.8)
  })

  it('starts fatigue after 15s and caps it', () => {
    expect(fatigueFor(10)).toBe(1)
    expect(fatigueFor(25)).toBeCloseTo(1.6)
    expect(fatigueFor(120)).toBe(2.2)
  })

  it('is off when scaled to 0, as on trip 1', () => {
    expect(maxDrift(8, 30, 0)).toBe(0)
  })

  it('repeats for the same seed', () => {
    expect(maxDrift(5, 0, 1, 9)).toBe(maxDrift(5, 0, 1, 9))
    expect(maxDrift(5, 0, 1, 9)).not.toBe(maxDrift(5, 0, 1, 10))
  })
})

describe('drift smoothing', () => {
  /** Largest per-frame drift move over 20s, with the speed from `speedAt(t)`. */
  function biggestStep(speedAt: (t: number) => number) {
    const drift = createDrift(rng(4))
    let biggest = 0
    for (let t = 0; t < 20_000; t += 1000 / 60) {
      const x = drift.x
      const y = drift.y
      stepDrift(drift, 1000 / 60, speedAt(t), 30, 1)
      if (t > 3000)
        biggest = Math.max(biggest, Math.hypot(drift.x - x, drift.y - y))
    }
    return biggest
  }

  it('moves no faster when you stop dead than while you run', () => {
    const steady = biggestStep(() => 8)
    const stopping = biggestStep(t => (Math.floor(t / 2000) % 2 === 1 ? 0 : 8))
    expect(stopping).toBeLessThan(steady * 1.5)
  })
})
