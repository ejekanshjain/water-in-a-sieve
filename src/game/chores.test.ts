import { describe, expect, it } from 'vitest'

import { createChoreBoard } from '../shared'
import { eyeX, stitchPoint } from './bench'
import {
  coverage,
  coveredSeconds,
  directorPicks,
  FROG_CHORE,
  WIPE_FLOOR_CHORE,
  type ChoreKind,
  type DirectorMoment
} from './chores'
import { crankHandle, Sim } from './sim'
import { makeSim, runPilot } from './testing'
import { BENCH_RADIUS, BENCH_X, BENCH_Y } from './tuning'
import { emptyInput } from './types'

const EVERY_CHORE = new Set<ChoreKind>([
  'frog',
  'wipe',
  'rewax',
  'cat',
  'plug',
  'leaves',
  'stone',
  'slippers'
])

/** Empties the raised bucket with five scripted scoops. */
function emptyBucket(sim: Sim) {
  for (let i = 0; i < 5; i++) sim.crankCircle(1, 800)
  const frame = emptyInput()
  for (let i = 0; i < 5; i++) {
    frame.grip = true
    frame.gripPressed = true
    frame.x = 270
    frame.y = 500
    sim.update(1000 / 60, frame)
    frame.gripPressed = false
    frame.y = 590
    for (let k = 0; k < 90; k++) sim.update(1000 / 60, frame)
    frame.y = 490
    for (let k = 0; k < 2; k++) sim.update(1000 / 60, frame)
    sim.drain('jolt')
  }
}

describe('chore director', () => {
  it('counts estimated chore time against the wait', () => {
    const board = createChoreBoard()
    board.add(FROG_CHORE)
    expect(coveredSeconds(board)).toBe(10)
    const ctx = { season: 'summer' as const, available: EVERY_CHORE }
    expect(directorPicks('refillArrive', board, 11, ctx)).toEqual([])
  })

  it('opens the first eligible chore for each moment, skipping ones not built yet', () => {
    const board = createChoreBoard()
    const only = (kinds: ChoreKind[]) => ({
      season: 'autumn' as const,
      available: new Set(kinds)
    })
    expect(directorPicks('refillArrive', board, 30, only(['frog']))).toEqual([
      'frog'
    ])
    expect(
      directorPicks('refillArrive', board, 11, only(['leaves', 'frog']))
    ).toEqual(['leaves'])
    // A longer wait keeps adding chores until it's covered.
    expect(
      directorPicks('refillArrive', board, 25, only(['leaves', 'frog']))
    ).toEqual(['leaves', 'frog'])
    expect(directorPicks('glueStart', board, 9, only(['frog']))).toEqual([
      'frog'
    ])
  })

  it('covers at least 70% of every wait start once the planned chores exist', () => {
    const moments: DirectorMoment[] = ['refillStart', 'glueStart']
    for (const season of ['summer', 'autumn', 'winter', 'spring'] as const)
      for (const moment of moments) {
        const board = createChoreBoard()
        const ctx = { season, available: EVERY_CHORE }
        for (const kind of directorPicks(moment, board, 60, ctx))
          board.add({ id: kind, label: kind })
        expect(coverage(moment, board, 60)).toBeGreaterThanOrEqual(0.7)
      }
  })

  it("makes a refill's house chore a wet floor, or the cat when its roll comes up", () => {
    const board = createChoreBoard()
    const ctx = { season: 'summer' as const, available: EVERY_CHORE }
    expect(directorPicks('refillStart', board, 60, ctx)).toEqual(['wipe'])
    expect(
      directorPicks('refillStart', board, 60, { ...ctx, catFirst: true })
    ).toEqual(['cat'])
  })

  it('counts the run back to the well when you reach the house', () => {
    const board = createChoreBoard()
    board.add(WIPE_FLOOR_CHORE)
    const ctx = { season: 'summer' as const, available: EVERY_CHORE }
    // The wet floor (10s plus walks, 24s) and the 7s run back cover 85% of 36s.
    expect(coverage('houseArrive', board, 36)).toBeCloseTo(31 / 36)
    expect(directorPicks('houseArrive', board, 36, ctx)).toEqual([])
    expect(directorPicks('houseArrive', board, 45, ctx)).toEqual(['cat'])
  })

  it('covers a refill start with the chores built today: the walk plus the frog', () => {
    const board = createChoreBoard()
    const ctx = {
      season: 'summer' as const,
      available: new Set<ChoreKind>(['frog'])
    }
    const picks = directorPicks('refillStart', board, 60, ctx)
    expect(picks).toEqual(['frog'])
    board.add(FROG_CHORE)
    expect(coverage('refillStart', board, 60)).toBeGreaterThanOrEqual(0.7)
  })

  /**
   * Empties the well bucket, then walks to the house and back while the refill runs:
   * coming back with time left on the wait puts the frog on the crank.
   */
  function frogOnReturn(seed: number) {
    const game = makeSim(seed)
    const { sim } = game
    emptyBucket(sim)
    expect(sim.goToHouse()).toBe(true)
    runPilot(game, () => sim.state.scene === 'well', 30_000)
    return game
  }

  it('leaves a wet floor when a refill starts, and the frog when you come back early', () => {
    const sim = new Sim(2, { now: () => 0 })
    emptyBucket(sim)
    expect(sim.state.waits.refill).not.toBeNull()
    expect(sim.state.house.floorPatch).toBe(true)
    expect(sim.chores.has('wipe')).toBe(true)
    expect(sim.state.well.frog).toBe('none')

    const { sim: back } = frogOnReturn(2)
    expect(back.state.waits.refill).not.toBeNull()
    expect(back.state.well.frog).toBe('on')
    expect(back.chores.blockersFor('crank').map(c => c.id)).toEqual(['frog'])
  })

  it('makes the frog hop back once, then clears the chore', () => {
    const game = frogOnReturn(3)
    const { sim } = game
    game.clock.now += 61_000
    sim.update(1000 / 60, emptyInput())
    expect(sim.crankBlocker()).toBe('Move the frog first.')
    const knob = crankHandle(sim.state.well.crankAngle)
    // A short drag doesn't count.
    sim.dragFrog(knob.x + 20, knob.y)
    sim.dropFrog(knob.x + 20, knob.y)
    expect(sim.state.well.frogMoves).toBe(0)
    sim.dragFrog(40, 760)
    sim.dropFrog(40, 760)
    expect(sim.state.well.frog).toBe('on')
    sim.dragFrog(40, 760)
    sim.dropFrog(40, 760)
    expect(sim.state.well.frog).toBe('none')
    expect(sim.chores.has('frog')).toBe(false)
    expect(sim.crankBlocker()).toBeNull()
  })
})

describe('mending at the bench', () => {
  /** A sim at the well with an empty sieve, two holes and the bench open. */
  function atBench(seed: number) {
    const game = makeSim(seed)
    const { sim } = game
    sim.addHoles(2)
    expect(sim.openBench()).toBe(true)
    return game
  }

  it('blocks scooping while holes are open or the glue is wet', () => {
    const game = makeSim(70)
    const { sim } = game
    sim.addHoles(2)
    expect(sim.scoopBlocker()).toBe('Mend the holes first.')
    expect(sim.chores.blockersFor('scoop').map(c => c.id)).toEqual(['mend'])
    sim.openBench()
    sim.threadNeedle(true)
    for (const hole of [...sim.state.holes])
      for (let i = 0; i < hole.points; i++) sim.stitch(hole.id, i)
    expect(sim.scoopBlocker()).toBe('Glue the stitches first.')
    expect(sim.applyGlue()).toBe(true)
    expect(sim.state.holes).toHaveLength(0)
    expect(sim.scoopBlocker()).toBe('The glue is still drying.')
    expect(sim.chores.has('mend')).toBe(false)
    game.clock.now += 60_000
    sim.update(1000 / 60, emptyInput())
    expect(sim.scoopBlocker()).toBeNull()
  })

  it('sways the eye further when your hands are shaky', () => {
    let calm = 0
    let shaky = 0
    for (let t = 0; t < 4; t += 0.01) {
      calm = Math.max(calm, Math.abs(eyeX(t, 0) - BENCH_X))
      shaky = Math.max(shaky, Math.abs(eyeX(t, 1) - BENCH_X))
    }
    expect(calm).toBeCloseTo(30, 0)
    expect(shaky).toBeGreaterThan(calm * 2.5)
  })

  it('stitches only in order; an out-of-order stitch unpicks the last one', () => {
    const { sim } = atBench(71)
    sim.threadNeedle(true)
    const hole = sim.state.holes[0]
    if (!hole) throw new Error('no hole')
    expect(sim.stitch(hole.id, 0)).toBe('stitch')
    expect(sim.stitch(hole.id, 1)).toBe('stitch')
    expect(sim.stitch(hole.id, 3)).toBe('unpick')
    expect(hole.stitched).toBe(1)
    expect(sim.stitch(hole.id, 0)).toBe('none')
    // The second hole waits its turn.
    const next = sim.state.holes[1]
    if (next) expect(sim.stitch(next.id, 0)).toBe('none')
  })

  it('needs a threaded needle to sew, and a miss starts the thread over', () => {
    const { sim } = atBench(72)
    const hole = sim.state.holes[0]
    if (!hole) throw new Error('no hole')
    expect(sim.stitch(hole.id, 0)).toBe('none')
    sim.threadNeedle(false)
    expect(sim.state.bench.threaded).toBe(false)
    sim.threadNeedle(true)
    expect(sim.stitch(hole.id, 0)).toBe('stitch')
    const point = stitchPoint(hole, 0, { x: 0, y: 0 })
    // Every stitch point sits inside the bench sieve's rim.
    for (const h of sim.state.holes)
      for (let i = 0; i < h.points; i++) {
        stitchPoint(h, i, point)
        expect(Math.hypot(point.x - BENCH_X, point.y - BENCH_Y)).toBeLessThan(
          BENCH_RADIUS - 20
        )
      }
  })

  it('lets the autopilot thread in 3 to 8 seconds and mend everything', () => {
    const game = makeSim(73)
    const { sim } = game
    sim.addHoles(2)
    let threadedAt = -1
    let openedAt = -1
    runPilot(
      game,
      () => sim.state.waits.glue !== null,
      60_000,
      () => {
        const s = sim.state
        if (s.bench.open && openedAt < 0) openedAt = s.timeMs
        if (s.bench.threaded && threadedAt < 0) threadedAt = s.timeMs
      }
    )
    expect(sim.state.waits.glue).not.toBeNull()
    const threadS = (threadedAt - openedAt) / 1000
    expect(threadS).toBeGreaterThanOrEqual(3)
    expect(threadS).toBeLessThanOrEqual(8)
    expect(sim.state.holes).toHaveLength(0)
  })
})
