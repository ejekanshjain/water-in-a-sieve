import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { crankLeaves, leafCapacity, scatterLeaves, type Leaf } from './leaves'
import { hold, makeSim, runPilot, STEP, type TestGame } from './testing'
import { emptyInput } from './types'

/** Cranks the bucket up (unless it's up) and holds the sieve in the water, then lifts it. */
function dipFull(game: TestGame, crank = true): number {
  const { sim } = game
  if (crank)
    for (let i = 0; i < sim.crankCircles(); i++) sim.crankCircle(1, 800)
  const frame = emptyInput()
  frame.grip = true
  frame.gripPressed = true
  frame.x = 270
  frame.y = 500
  sim.update(STEP, frame)
  frame.gripPressed = false
  frame.y = 590
  hold(game, frame, 3000)
  const scooped = sim.state.sieve.inSieve
  if (!crank) {
    frame.y = 490
    hold(game, frame, 50)
  }
  return scooped
}

describe('leaves in the well water', () => {
  it('cut a scoop by 15% each, up to three', () => {
    expect(leafCapacity(1000, 0)).toBe(1000)
    expect(leafCapacity(1000, 1)).toBe(850)
    expect(leafCapacity(1000, 3)).toBeCloseTo(550)
    expect(leafCapacity(3000, 9)).toBeCloseTo(1650)
  })

  it('never float more than three at once', () => {
    const leaves: Leaf[] = []
    expect(scatterLeaves(leaves, 2, rng(1), 1)).toBe(2)
    expect(scatterLeaves(leaves, 5, rng(2), 3)).toBe(1)
    expect(leaves.map(l => l.id)).toEqual([1, 2, 3])
    for (const leaf of leaves)
      expect(Math.hypot(leaf.u, leaf.v)).toBeLessThan(0.75)
  })

  it('come up with an autumn crank about 60% of the time', () => {
    const random = rng(9)
    let some = 0
    for (let i = 0; i < 1000; i++) if (crankLeaves(random) > 0) some++
    expect(some).toBeGreaterThan(550)
    expect(some).toBeLessThan(650)
  })

  it('cap the scoop at 55% with three, and clearing them restores a full scoop', () => {
    const clogged = makeSim(80)
    clogged.sim.dropLeaves(3)
    expect(clogged.sim.chores.has('leaves')).toBe(true)
    expect(dipFull(clogged)).toBe(550)

    const cleared = makeSim(80)
    cleared.sim.dropLeaves(3)
    for (const leaf of [...cleared.sim.state.well.leaves])
      expect(cleared.sim.removeLeaf(leaf.id)).toBe(true)
    expect(cleared.sim.chores.has('leaves')).toBe(false)
    expect(dipFull(cleared)).toBe(1000)
  })

  it("can't be dragged out while the sieve is in the water", () => {
    const game = makeSim(81)
    game.sim.dropLeaves(1)
    dipFull(game)
    const leaf = game.sim.state.well.leaves[0]
    expect(game.sim.state.well.dipped).toBe(true)
    expect(leaf && game.sim.removeLeaf(leaf.id)).toBe(false)
  })

  it('stay where they floated while you walk to the house and back', () => {
    const game = makeSim(82)
    const { sim } = game
    sim.dropLeaves(2)
    sim.placeLeaf(1, 0.4, -0.2, 1.1)
    const before = sim.state.well.leaves.map(l => ({ ...l }))
    expect(sim.goToHouse()).toBe(true)
    const s = sim.state
    runPilot(game, () => s.scene === 'house')
    expect(s.well.leaves).toEqual(before)
    // The autopilot clears them once it's back at the well.
    runPilot(game, () => s.scene === 'well')
    expect(s.well.leaves).toEqual(before)
  })

  it('blow in on the wind when an autumn refill leaves time on the clock', () => {
    const game = makeSim(83)
    const { sim } = game
    sim.setContainer(1, 0)
    expect(sim.state.season).toBe('autumn')
    // Empty the well bucket with five quick scoops, then pop to the house and back.
    for (let i = 0; i < sim.crankCircles(); i++) sim.crankCircle(1, 800)
    for (const leaf of [...sim.state.well.leaves]) sim.removeLeaf(leaf.id)
    for (let i = 0; i < 5; i++) {
      dipFull(game, false)
      sim.drain('jolt')
    }
    expect(sim.state.waits.refill).not.toBeNull()
    expect(sim.goToHouse()).toBe(true)
    runPilot(game, () => sim.state.scene === 'well', 30_000)
    expect(sim.chores.has('leaves')).toBe(true)
    expect(sim.state.well.leaves.length).toBeGreaterThanOrEqual(2)
    expect(sim.state.well.frog).toBe('on')
  })
})

describe('the falling leaf', () => {
  /** Carries the first scoop 20 m out, then drops a leaf. */
  function leafFalling(seed: number): TestGame {
    const game = makeSim(seed)
    const { sim } = game
    runPilot(game, () => sim.state.walker.distance > 20)
    sim.triggerEvent('leaf')
    return game
  }

  it('drains the sieve with cause leaves when you ignore it', () => {
    const game = leafFalling(84)
    const { sim } = game
    runPilot(
      game,
      () => sim.state.phase === 'drained',
      5000,
      frame => {
        frame.blow = false
      }
    )
    expect(sim.state.lastDrain?.cause).toBe('leaves')
    expect(sim.state.event?.outcome).toBe('failed')
    // It warned for the whole fall first.
    expect(sim.state.event?.ms).toBeGreaterThanOrEqual(1200)
    expect(sim.balanced()).toBe(true)
  })

  it('blows off when you blow at it, and the trip carries on', () => {
    const game = leafFalling(85)
    const { sim } = game
    let blown = false
    runPilot(
      game,
      () => sim.state.phase === 'poured',
      60_000,
      frame => {
        frame.blow = sim.state.event?.stage === 'warning'
        if (sim.state.event?.outcome === 'countered') blown = true
      }
    )
    expect(blown).toBe(true)
    expect(sim.state.stats.drains).toBe(0)
    expect(sim.state.hintsDone.leaf).toBe(true)
  })

  it('shakes the sieve while you blow', () => {
    const game = leafFalling(87)
    const { sim } = game
    // Stand still until the walking jolt dies down, then blow.
    runPilot(
      game,
      () => false,
      1500,
      frame => {
        frame.walk = false
        frame.blow = false
      }
    )
    expect(sim.state.steady.body).toBeLessThan(0.05)
    runPilot(
      game,
      () => false,
      300,
      frame => {
        frame.walk = false
        frame.blow = true
      }
    )
    expect(sim.state.steady.body).toBeGreaterThan(0.28)
  })
})
