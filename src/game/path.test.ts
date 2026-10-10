import { describe, expect, it } from 'vitest'

import {
  addDrainPatch,
  addPatch,
  agePatches,
  createPath,
  layBumps,
  makeBumps,
  patchAt,
  segmentOf,
  slipSpeed
} from './path'
import { predictedBumpLevel } from './steadiness'
import { makeSim, runPilot } from './testing'
import { MAX_PATCHES } from './tuning'

describe('path bumps', () => {
  it('spaces seeded bumps at least 8 m apart, clear of the last 5 m', () => {
    for (let seed = 1; seed < 200; seed++) {
      const bumps = makeBumps(6, seed)
      expect(bumps).toHaveLength(6)
      expect(bumps[0]).toBeGreaterThanOrEqual(10)
      expect(bumps[5]).toBeLessThanOrEqual(95)
      for (let i = 1; i < bumps.length; i++)
        expect((bumps[i] ?? 0) - (bumps[i - 1] ?? 0)).toBeGreaterThanOrEqual(
          7.9
        )
    }
  })

  it('teaches with one bump at 20 m on trip 1, then lays the seeded ones', () => {
    const path = createPath()
    layBumps(path, 1, 2, 1000)
    expect(path.bumps).toEqual([20])
    layBumps(path, 2, 2, 1000)
    expect(path.bumps).toEqual(makeBumps(2, 1000))
    expect(path.moles).toEqual([true, true])
  })

  it('never lays a bump on a paved segment', () => {
    const path = createPath()
    const seeded = makeBumps(6, 1200)
    const paved = segmentOf(seeded[0] ?? 0)
    path.stones[paved] = true
    layBumps(path, 5, 6, 1200)
    expect(path.bumps).toEqual(seeded.filter(at => segmentOf(at) !== paved))
    expect(path.moles).toHaveLength(5)
  })

  it('keeps the same bumps for the same seed and reshuffles for a new one', () => {
    expect(makeBumps(4, 7)).toEqual(makeBumps(4, 7))
    expect(makeBumps(4, 7)).not.toEqual(makeBumps(4, 8))
  })

  it('turns the ghost tick red above about 5.6 m/s', () => {
    expect(predictedBumpLevel(0.04, 5.4, false)).toBeLessThan(1)
    expect(predictedBumpLevel(0.04, 5.9, false)).toBeGreaterThanOrEqual(1)
    expect(predictedBumpLevel(0.04, 5.9, true)).toBeLessThan(1)
  })
})

describe('wet patches', () => {
  it('lands a drain patch 1.5 m ahead, so the walk back starts dry', () => {
    const path = createPath()
    const patch = addDrainPatch(path, 40)
    expect(patch.at).toBe(41.5)
    expect(patchAt(path, 40)).toBeNull()
    expect(patchAt(path, 41.5)).toBe(patch)
  })

  it('dries a patch after 3 trips outside winter, and keeps it in winter', () => {
    const path = createPath()
    addDrainPatch(path, 30)
    for (let i = 0; i < 3; i++) agePatches(path, 'summer')
    expect(path.patches).toHaveLength(1)
    agePatches(path, 'summer')
    expect(path.patches).toHaveLength(0)
    addDrainPatch(path, 30)
    for (let i = 0; i < 6; i++) agePatches(path, 'winter')
    expect(path.patches).toHaveLength(1)
  })

  it('caps the patches on a new trip, melting the oldest ice first', () => {
    const path = createPath()
    const first = addDrainPatch(path, 10)
    agePatches(path, 'winter')
    for (let at = 20; at <= 80; at += 10) addDrainPatch(path, at)
    const gone = agePatches(path, 'winter')
    expect(path.patches).toHaveLength(MAX_PATCHES)
    expect(gone.map(p => p.id)).toEqual([first.id, first.id + 1])
    expect(path.patches.every(p => p.kind === 'ice')).toBe(true)
  })

  it('slips above 1.5 m/s on wet ground and 1 m/s on ice, 1.5x in Assist Mode', () => {
    expect(slipSpeed('wet', false)).toBe(1.5)
    expect(slipSpeed('ice', false)).toBe(1)
    expect(slipSpeed('wet', true)).toBe(2.25)
  })

  it('slips later in dry slippers and sooner in soaked ones', () => {
    expect(slipSpeed('wet', false, 'dry')).toBe(2.5)
    expect(slipSpeed('ice', false, 'dry')).toBe(1.8)
    expect(slipSpeed('wet', false, 'soaked')).toBe(1)
    expect(slipSpeed('ice', false, 'soaked')).toBe(0.7)
    // On the washing line they're off your feet: barefoot speeds.
    expect(slipSpeed('wet', false, 'drying')).toBe(1.5)
  })
})

describe('path hazards in play', () => {
  /** Carries trip 2 at a held speed until the first bump, and reports what happened. */
  function bumpAt(speed: number) {
    const game = makeSim(51)
    const s = game.sim.state
    runPilot(game, () => s.trip === 2)
    const first = s.path.bumps[0] ?? 0
    let peak = 0
    runPilot(
      game,
      () => s.phase !== 'carry' || s.walker.distance > first + 3,
      60_000,
      frame => {
        frame.walk = s.walker.speed < speed
        peak = Math.max(peak, s.steady.total)
      }
    )
    return { drained: s.lastDrain?.cause ?? null, peak }
  }

  it('drains on a bump at 6 m/s and stays green at 2 m/s', () => {
    expect(bumpAt(6).drained).toBe('bump')
    const slow = bumpAt(2)
    expect(slow.drained).toBeNull()
    expect(slow.peak).toBeLessThan(0.55)
  })

  it('drains when you rush over a wet patch, and leaves the walk back dry', () => {
    const game = makeSim(52)
    const s = game.sim.state
    runPilot(game, () => s.trip === 2 && s.scene === 'path')
    addPatch(s.path, 30, 'wet')
    runPilot(
      game,
      () => s.phase === 'drained',
      60_000,
      frame => {
        frame.walk = s.walker.speed < 3
      }
    )
    expect(s.lastDrain?.cause).toBe('wetFloor')
    runPilot(game, () => s.scene === 'walkBack')
    expect(patchAt(s.path, s.walker.distance)).toBeNull()
  })

  it('sits you down on an empty-walk slip without spilling anything', () => {
    const game = makeSim(53)
    const s = game.sim.state
    runPilot(game, () => s.scene === 'walkBack')
    addPatch(s.path, 50, 'wet')
    runPilot(game, () => s.pratfallMs > 0, 30_000)
    expect(s.pratfallMs).toBeGreaterThan(0)
    expect(s.walker.speed).toBe(0)
    expect(game.sim.balanced()).toBe(true)
  })
})
