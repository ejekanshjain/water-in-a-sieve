import { describe, expect, it } from 'vitest'

import { CARRY_WALK, RUN_WALK } from './tuning'
import { createWalker, stepWalker } from './walker'

const STEP = 1000 / 60

describe('walker', () => {
  it('reaches 5 m/s after 2.3s of holding walk while carrying', () => {
    const walker = createWalker()
    for (let t = 0; t < 2273; t += STEP)
      stepWalker(walker, true, CARRY_WALK, STEP)
    expect(walker.speed).toBeCloseTo(5, 1)
  })

  it('slows at 6 m/s² once walk is released', () => {
    const walker = createWalker()
    walker.speed = 6
    for (let i = 0; i < 30; i++) stepWalker(walker, false, CARRY_WALK, STEP)
    expect(walker.speed).toBeCloseTo(3, 1)
  })

  it('runs the empty walk back in about 7s', () => {
    const walker = createWalker(100, -1)
    let ms = 0
    while (walker.distance > 0) {
      stepWalker(walker, true, RUN_WALK, STEP)
      ms += STEP
    }
    expect(ms / 1000).toBeGreaterThan(6)
    expect(ms / 1000).toBeLessThan(7.5)
  })

  it('lands a footstep every 0.8 m', () => {
    const walker = createWalker()
    let steps = 0
    while (walker.distance < 8)
      if (stepWalker(walker, true, CARRY_WALK, STEP)) steps++
    expect(steps).toBe(10)
  })
})
