import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import {
  addPatch,
  agePatches,
  createPath,
  patchAt,
  seasonPatches,
  wipeStrokes
} from './path'
import { hold, makeSim, runPilot, type TestGame } from './testing'
import { AUTUMN_LEAF_PILES } from './tuning'
import { emptyInput } from './types'

describe('season patches', () => {
  it('freezes every patch present when a winter trip starts, and melts it in spring', () => {
    const path = createPath()
    addPatch(path, 60, 'wet')
    agePatches(path, 'winter')
    expect(path.patches[0]?.kind).toBe('ice')
    for (let i = 0; i < 6; i++) agePatches(path, 'winter')
    expect(path.patches).toHaveLength(1)
    agePatches(path, 'spring')
    expect(path.patches[0]?.kind).toBe('wet')
  })

  it('drops fresh wet leaf piles each autumn trip, gone by the next', () => {
    const path = createPath()
    const random = rng(4)
    seasonPatches(path, 'autumn', random)
    const first = path.patches.map(p => p.id)
    const leaves = () => path.patches.filter(p => p.kind === 'leaves')
    expect(leaves()).toHaveLength(AUTUMN_LEAF_PILES)
    const gone = agePatches(path, 'autumn')
    expect(gone.map(p => p.id)).toEqual(first)
    seasonPatches(path, 'autumn', random)
    expect(leaves()).toHaveLength(AUTUMN_LEAF_PILES)
  })

  it('adds a spring puddle on about 40% of trips', () => {
    const random = rng(9)
    let puddles = 0
    for (let i = 0; i < 400; i++) {
      const path = createPath()
      puddles += seasonPatches(path, 'spring', random).length
    }
    expect(puddles / 400).toBeGreaterThan(0.33)
    expect(puddles / 400).toBeLessThan(0.47)
  })

  it('takes 12 strokes to wipe water or leaves and 20 to scrape ice', () => {
    expect(wipeStrokes('wet')).toBe(12)
    expect(wipeStrokes('leaves')).toBe(12)
    expect(wipeStrokes('ice')).toBe(20)
  })
})

/** Carries the next trip at about `speed` m/s until the carry ends. */
function carryAt(game: TestGame, speed: number) {
  const s = game.sim.state
  runPilot(game, () => s.scene === 'path')
  runPilot(
    game,
    () => s.phase !== 'carry',
    60_000,
    frame => {
      frame.walk = s.walker.speed < speed
    }
  )
}

describe('winter ice', () => {
  it('turns a 60 m drain into ice that slips you, drains you and tears a hole', () => {
    const game = makeSim(80)
    const { sim } = game
    const s = sim.state
    sim.setContainer(2, 20_000)
    expect(s.season).toBe('winter')
    runPilot(game, () => s.scene === 'path')
    s.path.bumps = []
    runPilot(game, () => s.walker.distance > 58.4 || s.phase !== 'carry')
    sim.drain('jolt')
    expect(patchAt(s.path, 59.9)?.kind).toBe('wet')
    runPilot(game, () => s.scene === 'well', 60_000)
    // The next trip starts: the puddle is ice now. Cross it at 2 m/s.
    runPilot(game, () => s.scene === 'path')
    expect(s.path.patches.some(p => p.kind === 'ice')).toBe(true)
    s.path.bumps = []
    carryAt(game, 2)
    expect(s.lastDrain?.cause).toBe('ice')
    expect(s.holes).toHaveLength(1)
    expect(sim.balanced()).toBe(true)
  })
})

describe('wiping on empty walks', () => {
  /** A walk back with a puddle at 50 m, run at `speed` m/s. */
  function walkBackOver(seed: number) {
    const game = makeSim(seed)
    const s = game.sim.state
    runPilot(game, () => s.scene === 'walkBack')
    addPatch(s.path, 50, 'wet')
    return game
  }

  it('opens the rub area when you stop on a puddle, and rubbing wipes it away', () => {
    const game = walkBackOver(81)
    const { sim } = game
    const s = sim.state
    // Stand a few metres short of the puddle.
    s.walker.distance = 54
    s.walker.speed = 0
    const frame = emptyInput()
    hold(game, frame, 100)
    expect(sim.contextAction()).toBe('wipe')
    sim.doContext()
    expect(s.wipe?.needed).toBe(12)
    for (let i = 0; i < 11; i++) sim.rub()
    expect(s.path.patches).toHaveLength(1)
    expect(sim.rub()).toBe(true)
    expect(s.path.patches).toHaveLength(0)
    expect(s.wipe).toBeNull()
  })

  it('stops you on the patch after a slip, and walking past keeps a chore open', () => {
    const game = walkBackOver(82)
    const { sim } = game
    const s = sim.state
    const frame = emptyInput()
    frame.walk = true
    // Running into it slips you; sitting on it opens the rub area.
    while (s.pratfallMs === 0 && s.scene === 'walkBack') hold(game, frame, 50)
    frame.walk = false
    hold(game, frame, 2500)
    expect(s.wipe?.target).toBe('path')
    sim.rub(5)
    // Walk off: the strokes stay on the patch and a chore remembers it.
    frame.walk = true
    hold(game, frame, 1500)
    expect(s.wipe).toBeNull()
    expect(s.path.patches[0]?.wiped).toBe(5)
    expect(sim.chores.list().map(c => c.label)).toContain(
      'Wipe the puddle at 50 m'
    )
  })
})

describe('house visits', () => {
  it('stays in the house after a splashy pour until you wipe the floor or walk off', () => {
    const game = makeSim(83)
    const { sim } = game
    const s = sim.state
    runPilot(game, () => s.phase === 'pour')
    runPilot(
      game,
      () => s.phase === 'visit',
      10_000,
      frame => {
        frame.x = s.house.pourAnchorX + 120
      }
    )
    expect(s.house.floorPatch).toBe(true)
    expect(s.wipe?.target).toBe('floor')
    expect(sim.contextAction()).toBe('goWell')
    for (let i = 0; i < 12; i++) sim.rub()
    expect(s.house.floorPatch).toBe(false)
    expect(sim.chores.has('wipe')).toBe(false)
    const frame = emptyInput()
    hold(game, frame, 100)
    frame.walk = true
    hold(game, frame, 100)
    expect(s.scene).toBe('walkBack')
    expect(s.tripReport).toMatch(/full\.$/)
  })

  it('walks empty to the house and back from the well', () => {
    const game = makeSim(84)
    const { sim } = game
    const s = sim.state
    expect(sim.contextAction()).toBe('goHouse')
    sim.doContext()
    expect(s.phase).toBe('toHouse')
    const frame = emptyInput()
    frame.walk = true
    hold(game, frame, 9000)
    // Still holding walk on arrival: you stay until you let go and walk again.
    expect(s.scene).toBe('house')
    expect(s.phase).toBe('visit')
    frame.walk = false
    hold(game, frame, 100)
    frame.walk = true
    hold(game, frame, 100)
    expect(s.scene).toBe('walkBack')
    hold(game, frame, 9000)
    expect(s.scene).toBe('well')
    expect(sim.balanced()).toBe(true)
  })
})
