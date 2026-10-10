import { describe, expect, it } from 'vitest'

import {
  CONTAINERS,
  containerBalanced,
  createContainers,
  drainContainer,
  receive,
  roomMl
} from './containers'
import { hold, makeSim, runPilot, type TestGame } from './testing'
import {
  CAT_DRINK_ML_PER_S,
  PLUG_HOLE_X,
  PLUG_HOLE_Y,
  PLUG_ML_PER_S
} from './tuning'
import { emptyInput } from './types'

describe('containers', () => {
  it('fills the bucket, sink and bathtub to 10, 20 and 100 L', () => {
    expect(CONTAINERS.map(c => c.capacityMl)).toEqual([10_000, 20_000, 100_000])
  })

  it('tracks room and locks once done', () => {
    const [bucket] = createContainers()
    const def = CONTAINERS[0]
    if (!bucket || !def) throw new Error('no bucket')
    receive(bucket, 9_000)
    expect(roomMl(bucket, def)).toBe(1_000)
    expect(containerBalanced(bucket)).toBe(true)
    bucket.done = true
    expect(roomMl(bucket, def)).toBe(0)
  })
})

describe('draining a container', () => {
  it('moves whole mL, carries fractions and never takes more than is there', () => {
    const [bucket] = createContainers()
    if (!bucket) throw new Error('no bucket')
    receive(bucket, 50)
    let moved = 0
    for (let i = 0; i < 60; i++) moved += drainContainer(bucket, 'cat', 0.4)
    expect(moved).toBe(24)
    expect(bucket.catDrunk).toBe(24)
    moved = drainContainer(bucket, 'plug', 1000)
    expect(moved).toBe(26)
    expect(bucket.inContainer).toBe(0)
    expect(drainContainer(bucket, 'plug', 1000)).toBe(0)
    expect(containerBalanced(bucket)).toBe(true)
  })

  it('leaves a full, locked container alone', () => {
    const [bucket] = createContainers()
    if (!bucket) throw new Error('no bucket')
    receive(bucket, 10_000)
    bucket.done = true
    expect(drainContainer(bucket, 'cat', 500)).toBe(0)
    expect(bucket.inContainer).toBe(10_000)
  })
})

describe('the cat', () => {
  /** A sim with `litres` in the container at `index`, standing at the well. */
  function withWater(index: number, litres: number): TestGame {
    const game = makeSim(90 + index)
    game.sim.setContainer(index, litres * 1000)
    return game
  }

  it('only drinks from a container holding 2 L or more', () => {
    expect(withWater(0, 1.5).sim.triggerCat()).toBe(false)
    const { sim } = withWater(0, 3)
    expect(sim.triggerCat()).toBe(true)
    expect(sim.chores.has('cat')).toBe(true)
  })

  it('drinks at its rate until you shoo it on a house visit', () => {
    const game = withWater(0, 5)
    const { sim } = game
    sim.triggerCat()
    hold(game, emptyInput(), 60_000)
    const bucket = sim.state.containers[0]
    const minute = CAT_DRINK_ML_PER_S * 60
    expect(bucket?.catDrunk).toBeGreaterThanOrEqual(minute - 1)
    expect(bucket?.catDrunk).toBeLessThanOrEqual(minute + 1)
    // Shooing needs you in the house with your hands free.
    expect(sim.shooCat()).toBe(false)
    expect(sim.goToHouse()).toBe(true)
    runPilot(game, () => sim.state.scene === 'house', 30_000)
    expect(sim.state.phase).toBe('visit')
    expect(sim.shooCat()).toBe(true)
    expect(sim.chores.has('cat')).toBe(false)
    const drunk = bucket?.catDrunk ?? 0
    hold(game, emptyInput(), 10_000)
    expect(bucket?.catDrunk).toBe(drunk)
    expect(bucket && containerBalanced(bucket)).toBe(true)
  })

  it('loses nothing while the game is paused', () => {
    const game = withWater(0, 5)
    const { sim } = game
    sim.triggerCat()
    sim.pause()
    hold(game, emptyInput(), 30_000)
    expect(sim.state.containers[0]?.catDrunk).toBe(0)
  })

  it('pulls the plug only in the bathtub phase, draining at its rate until fixed', () => {
    expect(withWater(1, 5).sim.triggerPlug()).toBe(false)
    const game = withWater(2, 20)
    const { sim } = game
    expect(sim.triggerPlug()).toBe(true)
    hold(game, emptyInput(), 60_000)
    const tub = sim.state.containers[2]
    const minute = PLUG_ML_PER_S * 60
    expect(tub?.plugDrained).toBeGreaterThanOrEqual(minute - 1)
    expect(tub?.plugDrained).toBeLessThanOrEqual(minute + 1)
    // Losing water never turns the year back.
    expect(sim.state.season).toBe('winter')
    expect(sim.goToHouse()).toBe(true)
    runPilot(game, () => sim.state.scene === 'house', 30_000)
    // Dropped short of the hole, the plug swings back onto the rim.
    sim.dragPlug(300, 600)
    expect(sim.dropPlug(300, 600)).toBe(false)
    expect(sim.state.cat.plugOut).toBe(true)
    sim.dragPlug(PLUG_HOLE_X + 5, PLUG_HOLE_Y - 5)
    expect(sim.dropPlug(PLUG_HOLE_X + 5, PLUG_HOLE_Y - 5)).toBe(true)
    expect(sim.chores.has('plug')).toBe(false)
    const drained = tub?.plugDrained ?? 0
    hold(game, emptyInput(), 10_000)
    expect(tub?.plugDrained).toBe(drained)
  })

  it('keeps you in the house after a pour while the cat drinks, and the autopilot shoos it', () => {
    const game = withWater(0, 4)
    const { sim } = game
    sim.triggerCat()
    runPilot(game, () => sim.state.phase === 'visit', 120_000)
    expect(sim.state.cat.mood).toBe('drinking')
    runPilot(game, () => sim.state.scene === 'walkBack', 30_000)
    expect(sim.state.cat.mood).toBe('away')
  })

  it('starts drinking when a refill begins, if the container is worth it', () => {
    const game = withWater(0, 3)
    const { sim } = game
    runPilot(game, () => sim.state.waits.refill !== null, 400_000)
    expect(sim.state.cat.mood).toBe('drinking')
  })
})
