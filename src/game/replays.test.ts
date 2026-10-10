import { describe, expect, it } from 'vitest'

import {
  claimReplay,
  createReplayLog,
  drainSpot,
  type DrainRecord
} from './replays'
import { makeSim, runPilot } from './testing'

/** A drain with sensible defaults: a full 1 L sieve on trip 10, on the path. */
function drain(over: Partial<DrainRecord> = {}): DrainRecord {
  return {
    cause: 'jolt',
    ml: 1000,
    distance: 50,
    trip: 10,
    scene: 'path',
    walkIn: 0,
    pouring: false,
    container: 2,
    capacityMl: 1000,
    replay: false,
    ...over
  }
}

describe('automatic replays', () => {
  it('replays the first path drain at 10 m or more, and only that one early on', () => {
    const log = createReplayLog()
    expect(claimReplay(log, drain({ trip: 1, distance: 6 }))).toBe(false)
    expect(claimReplay(log, drain({ trip: 2, distance: 22 }))).toBe(true)
    // Later drains mid-path don't, however far apart.
    expect(claimReplay(log, drain({ trip: 9, distance: 40 }))).toBe(false)
  })

  it('replays painful drains near the house or in it, with half a sieve or more', () => {
    const log = createReplayLog()
    log.firstDone = true
    expect(claimReplay(log, drain({ trip: 5, distance: 95 }))).toBe(true)
    expect(claimReplay(log, drain({ trip: 8, scene: 'house' }))).toBe(true)
    // Under half a sieve isn't worth one.
    expect(claimReplay(log, drain({ trip: 12, distance: 90, ml: 400 }))).toBe(
      false
    )
    // At the well it never is.
    expect(claimReplay(log, drain({ trip: 20, scene: 'well' }))).toBe(false)
  })

  it('plays at most one per 3 trips', () => {
    const log = createReplayLog()
    expect(claimReplay(log, drain({ trip: 4, distance: 90 }))).toBe(true)
    expect(claimReplay(log, drain({ trip: 5, distance: 96 }))).toBe(false)
    expect(claimReplay(log, drain({ trip: 6, scene: 'house' }))).toBe(false)
    expect(claimReplay(log, drain({ trip: 7, scene: 'house' }))).toBe(true)
  })
})

describe('replay labels', () => {
  it('counts steps to the container in the house', () => {
    expect(drainSpot(drain({ scene: 'house', walkIn: 3.5 }))).toBe(
      '1 step from the tub'
    )
    expect(drainSpot(drain({ scene: 'house', walkIn: 1, container: 1 }))).toBe(
      '4 steps from the sink'
    )
    expect(drainSpot(drain({ scene: 'house', pouring: true }))).toBe(
      'Mid-pour, over the tub'
    )
  })

  it('counts metres to the house, or from the well early on', () => {
    expect(drainSpot(drain({ distance: 92.4 }))).toBe('8 m from the house')
    expect(drainSpot(drain({ distance: 99.9 }))).toBe('1 m from the house')
    expect(drainSpot(drain({ distance: 12.7 }))).toBe('12 m from the well')
  })
})

describe('replays in the sim', () => {
  it('marks a full-sieve drain at 95 m on trip 1 for a replay, with its walk-in and container', () => {
    const game = makeSim(4)
    const { sim } = game
    const s = sim.state
    runPilot(game, () => s.scene === 'path' && s.walker.distance >= 95)
    sim.drain('fly')
    expect(s.lastDrain?.replay).toBe(true)
    expect(drainSpot(s.lastDrain!)).toMatch(/^[1-5] m from the house$/)
    const event = sim.events.find(e => e.type === 'drain')
    expect(event?.type === 'drain' && event.record.replay).toBe(true)
  })

  it('offers Share This Fail on the walk back, and not once you are home', () => {
    const game = makeSim(6)
    const { sim } = game
    const s = sim.state
    runPilot(game, () => s.scene === 'path' && s.walker.distance >= 40)
    sim.drain('dog')
    expect(s.share).toEqual({ kind: 'fail' })
    runPilot(game, () => s.scene === 'walkBack')
    // Your own puddle gets the Wipe prompt first; a few steps on, Share takes the slot.
    runPilot(game, () => sim.contextAction() === 'share', 3000)
    expect(sim.contextAction()).toBe('share')
    runPilot(game, () => s.scene === 'well', 20_000)
    expect(s.share).toBeNull()
    expect(sim.contextAction()).not.toBe('share')
  })
})
