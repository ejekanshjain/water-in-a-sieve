import { afterEach, describe, expect, it } from 'vitest'

import { settings } from '../shared'
import { BodyLevel, bumpAmplitude, gait, totalLevel } from './steadiness'
import { makeSim } from './testing'
import { HAND_ASSIST_SCALE } from './tuning'

const STEP = 1000 / 60

afterEach(() => {
  settings.set({ sensitivity: 1, assist: false })
})

/** Walks at `speed` for 1s, then adds a bump and returns the peak body level. */
function bumpPeak(speed: number): number {
  const body = new BodyLevel()
  for (let t = 0; t < 1000; t += STEP)
    body.step(gait(speed), STEP, settings.get().assist)
  body.pulse(bumpAmplitude(speed), 120, 'bump')
  let peak = 0
  for (let t = 0; t < 400; t += STEP) {
    body.step(gait(speed), STEP, settings.get().assist)
    peak = Math.max(peak, body.level)
  }
  return peak
}

describe('steadiness', () => {
  it('reads gait at 2, 4, 6 and 8 m/s', () => {
    expect(gait(2)).toBeCloseTo(0.0375)
    expect(gait(4)).toBeCloseTo(0.15)
    expect(gait(6)).toBeCloseTo(0.3375)
    expect(gait(8)).toBeCloseTo(0.6)
  })

  it('lets a 120 ms pulse reach 95% of its amplitude', () => {
    const body = new BodyLevel()
    body.pulse(1, 120, 'bump')
    let peak = 0
    for (let t = 0; t < 300; t += STEP) {
      body.step(0, STEP, false)
      peak = Math.max(peak, body.level)
    }
    expect(peak).toBeGreaterThan(0.93)
    expect(peak).toBeLessThan(1)
  })

  it('breaks on a bump at 6 m/s and stays green at 2 m/s', () => {
    expect(bumpPeak(6)).toBeGreaterThanOrEqual(0.97)
    expect(bumpPeak(2)).toBeLessThan(0.55)
  })

  it('never lets Sensitivity soften the body, and Assist Mode only by 0.85', () => {
    settings.set({ sensitivity: 0.5 })
    expect(bumpPeak(8)).toBeGreaterThan(1)
    settings.set({ sensitivity: 1, assist: true })
    expect(bumpPeak(8)).toBeGreaterThan(1)
    expect(bumpPeak(8)).toBeCloseTo((gait(8) + bumpAmplitude(8)) * 0.85, 1)
  })

  it('scales the hand reading with Assist Mode and Sensitivity', () => {
    const read = () => {
      const { hand } = makeSim(1).sim
      for (let t = 0; t < 500; t += STEP) hand.feed(1, STEP)
      return hand.level
    }
    const normal = read()
    settings.set({ assist: true })
    expect(read()).toBeCloseTo(normal * HAND_ASSIST_SCALE, 2)
    settings.set({ assist: false, sensitivity: 0.5 })
    expect(read()).toBeCloseTo(normal * 0.5, 2)
  })

  it('names the break after the largest active pulse', () => {
    const body = new BodyLevel()
    body.pulse(0.3, 200, 'letGo')
    body.pulse(0.9, 120, 'bump')
    expect(body.largestCause()).toBe('bump')
    for (let t = 0; t < 300; t += STEP) body.step(0, STEP, false)
    expect(body.largestCause()).toBeNull()
  })

  it('weights the total for the Bigger Sieve', () => {
    expect(totalLevel(0.2, 0.4, 1.25)).toBeCloseTo(0.75)
  })
})
