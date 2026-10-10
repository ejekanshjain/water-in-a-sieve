import { describe, expect, it } from 'vitest'

import {
  createRealWalk,
  detectStep,
  stepPulse,
  stepRealWalker,
  type RealWalk
} from './steps'
import { CARRY_WALK, REAL_STOP_MS } from './tuning'
import { createWalker } from './walker'

const STEP = 1000 / 60

/** Jolts at `peak` for 120 ms, then rests at 0.1 m/s² until `everyMs`. Returns peaks seen. */
function footfall(rw: RealWalk, peak: number, everyMs = 550): number[] {
  const seen: number[] = []
  for (let t = 0; t < everyMs; t += STEP) {
    const got = detectStep(rw, t < 120 ? peak : 0.1, STEP)
    if (got > 0) seen.push(got)
  }
  return seen
}

describe('walk for real', () => {
  it('counts one step per jolt peak and reports its peak', () => {
    const rw = createRealWalk()
    expect(footfall(rw, 1.6)).toEqual([1.6])
    expect(footfall(rw, 3.5)).toEqual([3.5])
    expect(rw.steps).toBe(2)
  })

  it('ignores a resting phone and counts a held jolt once', () => {
    const rw = createRealWalk()
    expect(footfall(rw, 0.5)).toEqual([])
    let count = 0
    for (let t = 0; t < 300; t += STEP) if (detectStep(rw, 2, STEP)) count++
    expect(count).toBe(0)
    // Past STEP_MAX_MS the held jolt lands as one step, and the min gap stops a second.
    for (let t = 0; t < 400; t += STEP) if (detectStep(rw, 2, STEP)) count++
    expect(count).toBe(1)
  })

  it('walks 100 m on 50 steps at a steady rhythm, then stands still', () => {
    const rw = createRealWalk()
    const walker = createWalker()
    let fastest = 0
    for (let i = 0; i < 50; i++) {
      for (let t = 0; t < 550; t += STEP) {
        detectStep(rw, t < 120 ? 1.5 : 0.1, STEP)
        stepRealWalker(walker, rw, CARRY_WALK, STEP)
        fastest = Math.max(fastest, walker.speed)
      }
      if (i === 48) expect(walker.distance).toBeLessThan(98.01)
    }
    for (let t = 0; t < REAL_STOP_MS; t += STEP) {
      detectStep(rw, 0.1, STEP)
      stepRealWalker(walker, rw, CARRY_WALK, STEP)
    }
    expect(walker.distance).toBeCloseTo(100, 5)
    expect(walker.speed).toBe(0)
    // 2 m every 0.55s is a 3.6 m/s walk.
    expect(fastest).toBeCloseTo(2 / 0.55, 1)
  })

  it('takes a first step from standing at 1 m/s, and slow steps cover less ground', () => {
    const rw = createRealWalk()
    const walker = createWalker()
    for (let t = 0; t < 2500; t += STEP) {
      detectStep(rw, t < 120 ? 1.5 : 0.1, STEP)
      stepRealWalker(walker, rw, CARRY_WALK, STEP)
      if (t > 150 && t < 1000) expect(walker.speed).toBeCloseTo(1)
    }
    // Stopped after REAL_STOP_MS: the rest of the stride is dropped.
    expect(walker.distance).toBeLessThan(1.3)
    expect(walker.speed).toBe(0)
  })

  it('keeps gentle steps small and makes a 3 m/s² stomp break on its own', () => {
    expect(stepPulse(1)).toBeCloseTo(0.15)
    expect(stepPulse(2)).toBeCloseTo(0.15)
    expect(stepPulse(2.5)).toBeLessThan(0.55)
    expect(stepPulse(3)).toBeCloseTo(1)
    expect(stepPulse(5)).toBeGreaterThan(5)
  })
})
