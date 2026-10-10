import { describe, expect, it } from 'vitest'

import { Sim } from './sim'
import { SIEVE_DEEPEST_Y, SIEVE_HOVER_Y } from './tuning'
import { emptyInput } from './types'
import {
  crankCircle,
  crankLetGo,
  crankNeeded,
  createWell,
  waterLineY
} from './well'

const STEP = 1000 / 60

describe('well crank', () => {
  it('raises the bucket after 5 circles, 6 in winter', () => {
    expect(crankNeeded(false)).toBe(5)
    expect(crankNeeded(true)).toBe(6)
    const well = createWell(0)
    for (let i = 0; i < 4; i++)
      expect(crankCircle(well, 1, 800, 5)).toBe('turn')
    expect(crankCircle(well, 1, 800, 5)).toBe('up')
    expect(well.bucketUp).toBe(true)
    expect(well.scoopsLeft).toBe(5)
  })

  it('unwinds a circle when you crank the wrong way', () => {
    const well = createWell(0)
    crankCircle(well, 1, 800, 5)
    crankCircle(well, 1, 800, 5)
    expect(crankCircle(well, -1, 800, 5)).toBe('unwind')
    expect(well.crankTurns).toBe(1)
  })

  it('spins back down when you let go mid-crank', () => {
    const well = createWell(0)
    crankCircle(well, 1, 800, 5)
    crankCircle(well, 1, 800, 5)
    expect(crankLetGo(well)).toBe(true)
    expect(well.crankTurns).toBe(0)
    expect(crankLetGo(well)).toBe(false)
  })

  it('slops a scoop for each circle under 0.55s', () => {
    const well = createWell(0)
    expect(crankCircle(well, 1, 400, 5)).toBe('slam')
    for (let i = 0; i < 4; i++) crankCircle(well, 1, 800, 5)
    expect(well.scoopsLeft).toBe(4)
  })

  it('lowers the water line with each scoop', () => {
    expect(waterLineY(4)).toBeGreaterThan(waterLineY(5))
  })
})

describe('well scooping and refills', () => {
  /** Dips the held sieve, lifts it out of the water, then empties it. */
  function scoop(sim: Sim) {
    const frame = emptyInput()
    frame.grip = true
    frame.gripPressed = true
    frame.x = 270
    frame.y = 500
    sim.update(STEP, frame)
    frame.gripPressed = false
    frame.y = 500 + (SIEVE_DEEPEST_Y - 5 - SIEVE_HOVER_Y)
    for (let i = 0; i < 90; i++) sim.update(STEP, frame)
    frame.y = 500 - 10
    for (let i = 0; i < 2; i++) sim.update(STEP, frame)
    sim.drain('jolt')
  }

  it('keeps the bucket up for 5 scoops, then refills for 60s while the crank waits', () => {
    const clock = { now: 0 }
    const sim = new Sim(1, { now: () => clock.now })
    for (let i = 0; i < 5; i++) sim.crankCircle(1, 800)
    expect(sim.state.well.bucketUp).toBe(true)
    for (let i = 0; i < 4; i++) scoop(sim)
    expect(sim.state.well.scoopsLeft).toBe(1)
    expect(sim.state.waits.refill).toBeNull()
    scoop(sim)
    expect(sim.state.well.bucketUp).toBe(false)
    expect(sim.state.waits.refill).not.toBeNull()
    expect(sim.crankBlocker()).toBe('The well is refilling.')
    expect(sim.crankCircle(1, 800)).toBeNull()
    clock.now += 59_000
    sim.update(STEP, emptyInput())
    expect(sim.state.waits.refill).not.toBeNull()
    clock.now += 1_100
    sim.update(STEP, emptyInput())
    expect(sim.state.waits.refill).toBeNull()
  })
})
