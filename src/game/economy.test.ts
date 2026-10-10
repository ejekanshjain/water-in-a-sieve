import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import { coinsFor, noDripBonus, startingNoDrip } from './economy'
import { gaitScale, rollWish, WISH_FROG_LINE } from './kit'
import type { TripRecord } from './sim'
import { gripFrame, hold, makeSim, runPilot } from './testing'
import { rollHouseTrouble, startCat } from './trouble'
import { BIG_SIEVE_WEIGHT } from './tuning'
import { emptyInput } from './types'

const TRIP: TripRecord = {
  trip: 1,
  scoopedMl: 950,
  countedLossMl: 0,
  maxDistance: 100,
  deliveredMl: 800,
  splashedMl: 0,
  container: 0,
  noDrip: 'intact',
  roseTorn: false,
  lastTrip: false
}

describe('economy', () => {
  it('pays 30 coins per litre, rounded per delivery', () => {
    expect(coinsFor(0)).toBe(0)
    expect(coinsFor(840)).toBe(25)
    expect(coinsFor(2_660)).toBe(80)
  })

  it('starts the No-Drip badge only for a 90% scoop', () => {
    expect(startingNoDrip(900, 1000)).toBe('intact')
    expect(startingNoDrip(899, 1000)).toBe('none')
  })

  it('pays the No-Drip bonus only while the badge is intact', () => {
    expect(noDripBonus(TRIP)).toBe(30)
    expect(noDripBonus({ ...TRIP, noDrip: 'cracked' })).toBe(0)
    expect(noDripBonus({ ...TRIP, deliveredMl: 0 })).toBe(0)
  })

  it('cracks the badge on a single slosh tick', () => {
    const game = makeSim(31)
    runPilot(game, () => game.sim.state.walker.distance > 20)
    expect(game.sim.state.current.noDrip).toBe('intact')
    runPilot(
      game,
      () => game.sim.state.steady.total > 0.56,
      2000,
      frame => {
        frame.handAccel = 3_900
      }
    )
    const s = game.sim.state
    hold(
      game,
      gripFrame(s.grip.anchorX - s.drift.x, s.grip.anchorY - s.drift.y),
      20
    )
    expect(game.sim.state.current.noDrip).toBe('cracked')
  })

  it('pays +150 when the bucket fills, and moves on to the sink', () => {
    const game = makeSim(32)
    const bucket = game.sim.state.containers[0]
    if (!bucket) throw new Error('no bucket')
    bucket.inContainer = bucket.delivered = 9_500
    runPilot(game, () => game.sim.state.phase === 'poured')
    expect(bucket.done).toBe(true)
    expect(game.sim.state.containerIndex).toBe(1)
    const history = game.sim.wallet.store.get().history.map(t => t.reason)
    expect(history).toContain('Bucket filled')
  })
})

describe('shop', () => {
  /** A sim at the well with coins to spend. */
  function rich(seed: number, coins = 1_000) {
    const game = makeSim(seed)
    game.sim.wallet.earn(coins, 'Test')
    return game
  }

  it('only opens with an empty sieve, at the well or on a house visit', () => {
    const game = rich(40)
    const { sim } = game
    expect(sim.canShop()).toBe(true)
    runPilot(game, () => sim.state.scene === 'path')
    expect(sim.canShop()).toBe(false)
    runPilot(game, () => sim.state.scene === 'walkBack')
    expect(sim.canShop()).toBe(false)
  })

  it('sells Wax Coating that wears off after 10 trips and comes back with 20 rubs', () => {
    const game = rich(41)
    const { sim } = game
    expect(sim.buy('wax')).toBe(true)
    expect(sim.wallet.coins()).toBe(1_000 - 60)
    expect(sim.state.gear.wax).toBe(true)
    expect(sim.state.kit.waxTripsLeft).toBe(10)
    expect(sim.buy('wax')).toBe(false)
    // The tenth waxed trip still has wax; it wears off as that trip ends.
    sim.state.kit.waxTripsLeft = 1
    runPilot(game, () => sim.state.scene === 'path')
    expect(sim.state.gear.wax).toBe(true)
    runPilot(game, () => sim.state.scene === 'walkBack')
    expect(sim.state.gear.wax).toBe(false)
    expect(sim.chores.has('rewax')).toBe(true)
    runPilot(
      game,
      () => sim.state.scene === 'well',
      30_000,
      frame => {
        frame.walk = true
      }
    )
    expect(sim.openBench('wax')).toBe(true)
    expect(sim.rubWax(19)).toBe(false)
    expect(sim.rubWax(1)).toBe(true)
    expect(sim.state.gear.wax).toBe(true)
    expect(sim.state.kit.waxTripsLeft).toBe(10)
    expect(sim.chores.has('rewax')).toBe(false)
    expect(sim.state.bench.open).toBe(false)
  })

  it('offers Rewax to a glue wait once the wax is due within 3 trips', () => {
    const game = rich(42)
    const { sim } = game
    sim.buy('wax')
    sim.state.kit.waxTripsLeft = 3
    sim.addHoles(1)
    expect(sim.openBench('mend')).toBe(true)
    sim.state.bench.threaded = true
    const hole = sim.state.holes[0]
    if (!hole) throw new Error('no hole')
    for (let i = 0; i < hole.points; i++) sim.stitch(hole.id, i)
    expect(sim.applyGlue()).toBe(true)
    // The bench stays open and turns to the wax while the glue dries.
    expect(sim.chores.has('rewax')).toBe(true)
    expect(sim.state.bench.open).toBe(true)
    expect(sim.state.bench.mode).toBe('wax')
  })

  it('sells Slippers: softer steps until a drain soaks them, then a minute on the line', () => {
    const game = rich(43)
    const { sim, clock } = game
    sim.buy('slippers')
    expect(sim.state.kit.slippers).toBe('dry')
    expect(gaitScale('dry')).toBe(0.7)
    expect(gaitScale('soaked')).toBe(1)
    runPilot(game, () => sim.state.walker.distance > 20)
    sim.drain('jolt')
    expect(sim.state.kit.slippers).toBe('soaked')
    expect(sim.chores.has('slippers')).toBe(true)
    runPilot(
      game,
      () => sim.state.scene === 'well',
      30_000,
      frame => {
        frame.walk = true
      }
    )
    expect(sim.hangSlippers()).toBe(true)
    expect(sim.state.kit.slippers).toBe('drying')
    expect(sim.chores.has('slippers')).toBe(false)
    clock.now += 60_000
    hold(game, emptyInput(), 20)
    expect(sim.state.kit.slippers).toBe('dry')
    expect(sim.state.waits.slippers).toBeNull()
  })

  it('sells a Fly Swatter that kills a fly in one swing, with a 0.55 jolt', () => {
    const game = rich(44)
    const { sim } = game
    runPilot(game, () => sim.state.walker.distance > 20)
    sim.triggerEvent('fly')
    // No swatter yet: R does nothing.
    runPilot(
      game,
      () => sim.state.event?.stage === 'warning',
      2000,
      frame => {
        frame.swat = true
      }
    )
    expect(sim.state.kit.swingMs).toBe(0)
    sim.buy('swatter')
    expect(sim.contextAction()).toBe('swat')
    const before = sim.state.steady.body
    runPilot(
      game,
      () => sim.state.kit.swingMs > 0,
      200,
      frame => {
        frame.swat = true
        frame.walk = false
      }
    )
    expect(sim.state.event?.outcome).toBe('countered')
    expect(sim.state.stats.fliesSwatted).toBe(1)
    hold(game, emptyInput(), 100)
    expect(sim.state.steady.body).toBeGreaterThan(before + 0.3)
  })

  it('drains with cause swat when you swing at full speed', () => {
    const game = rich(45)
    const { sim } = game
    sim.buy('swatter')
    runPilot(game, () => sim.state.walker.distance > 20)
    sim.state.walker.speed = 8
    runPilot(
      game,
      () => sim.state.phase === 'drained',
      500,
      frame => {
        frame.walk = true
        frame.swat = true
      }
    )
    expect(sim.state.lastDrain?.cause).toBe('swat')
  })

  it('grants wishes only at the well, and one in 6 brings the frog back', () => {
    const random = rng(7)
    let frogs = 0
    for (let i = 0; i < 6_000; i++) if (rollWish(random).frog) frogs++
    expect(frogs / 6_000).toBeCloseTo(1 / 6, 1)
    const game = rich(46)
    const { sim } = game
    expect(sim.jokeBlocker('wish')).toBeNull()
    let line: string | null = null
    for (let i = 0; i < 40 && sim.state.well.frog === 'none'; i++)
      line = sim.buyJoke('wish')
    expect(line).toBe(WISH_FROG_LINE)
    expect(sim.chores.has('frog')).toBe(true)
    expect(sim.state.kit.wishes).toBeGreaterThan(0)
    sim.goToHouse()
    expect(sim.jokeBlocker('wish')).toBe('notHere')
    expect(sim.buyJoke('wish')).toBeNull()
  })

  it('sells Cat Treats that keep the cat off your water for 5 trips', () => {
    const game = rich(47)
    const { sim } = game
    sim.setContainer(1, 5_000)
    expect(sim.triggerCat()).toBe(true)
    expect(sim.buyJoke('treats')).toBe(
      'The cat drops your water for the treats.'
    )
    expect(sim.state.cat.mood).toBe('away')
    expect(sim.chores.has('cat')).toBe(false)
    expect(sim.wallet.coins()).toBe(1_000 - 40)
    for (let trip = 0; trip < 5; trip++) {
      expect(startCat(sim)).toBe(false)
      rollHouseTrouble(sim)
      expect(sim.state.cat.mood).toBe('away')
    }
    expect(sim.state.kit.treatTrips).toBe(0)
    expect(startCat(sim)).toBe(true)
  })

  it('sells one Party Hat, which does nothing', () => {
    const game = rich(48)
    const { sim } = game
    expect(sim.buyJoke('hat')).toBe('You look great. It does nothing.')
    expect(sim.state.kit.hat).toBe(true)
    expect(sim.jokeBlocker('hat')).toBe('owned')
    expect(sim.buyJoke('hat')).toBeNull()
    expect(sim.wallet.coins()).toBe(1_000 - 150)
  })

  it("refuses joke buys you can't afford", () => {
    const game = rich(49, 30)
    expect(game.sim.jokeBlocker('treats')).toBe('poor')
    expect(game.sim.buyJoke('treats')).toBeNull()
    expect(game.sim.wallet.coins()).toBe(30)
  })
})

describe('the autopilot and the kit', () => {
  it('rewaxes and hangs soaked slippers at the well before scooping again', () => {
    const game = makeSim(50)
    const { sim } = game
    sim.buy('wax', { free: true })
    sim.buy('slippers', { free: true })
    sim.state.kit.waxTripsLeft = 1
    runPilot(game, () => sim.state.walker.distance > 20)
    sim.drain('jolt')
    expect(sim.state.kit.slippers).toBe('soaked')
    runPilot(game, () => sim.state.trip === 2)
    expect(sim.state.gear.wax).toBe(true)
    expect(sim.state.kit.waxTripsLeft).toBe(9)
    expect(sim.state.kit.slippers).toBe('drying')
    expect(sim.chores.has('rewax')).toBe(false)
    expect(sim.chores.has('slippers')).toBe(false)
  })
})

describe('sieve upgrades', () => {
  it('holds 1.5 L with Finer Mesh, then 3.0 L with the Bigger Sieve too', () => {
    const { sim } = makeSim(51)
    expect(sim.state.capacityMl).toBe(1_000)
    sim.buy('finerMesh', { free: true })
    expect(sim.state.capacityMl).toBe(1_500)
    sim.buy('biggerSieve', { free: true })
    expect(sim.state.capacityMl).toBe(3_000)
  })

  it('fills slowly with Finer Mesh: about 3 s of dipping to 95%', () => {
    const game = makeSim(52)
    const { sim } = game
    sim.buy('finerMesh', { free: true })
    for (let i = 0; i < 5; i++) sim.crankCircle(1, 800)
    const frame = gripFrame(270, 500)
    frame.gripPressed = true
    hold(game, frame, 20)
    frame.gripPressed = false
    frame.y = 590
    hold(game, frame, 1_000)
    const afterOne = sim.state.sieve.inSieve
    hold(game, frame, 2_000)
    expect(afterOne).toBeLessThan(0.7 * 1_500)
    expect(sim.state.sieve.inSieve).toBeGreaterThan(0.94 * 1_500)
  })

  it('weighs every wobble more with the Bigger Sieve', () => {
    const game = makeSim(53)
    const { sim } = game
    runPilot(game, () => sim.state.walker.distance > 20)
    const light = sim.state.steady.total
    sim.state.gear.biggerSieve = true
    hold(
      game,
      gripFrame(
        sim.state.grip.anchorX - sim.state.drift.x,
        sim.state.grip.anchorY - sim.state.drift.y
      ),
      1
    )
    const { hand, body, total } = sim.state.steady
    expect(total).toBeCloseTo((hand + body) * BIG_SIEVE_WEIGHT, 5)
    expect(light).toBeGreaterThan(0)
  })
})

describe('Paved Path', () => {
  /** A sim on its first walk back with Paved Path bought. */
  function walkingBack(seed: number) {
    const game = makeSim(seed)
    game.sim.buy('pavedPath', { free: true })
    runPilot(
      game,
      () => game.sim.state.scene === 'walkBack',
      120_000,
      f => {
        // The pilot lays stones itself; hold it off until we look.
        if (game.sim.state.scene === 'walkBack') f.walk = false
      }
    )
    return game
  }

  it('offers one stone per empty walk, for the first unpaved segment', () => {
    const game = walkingBack(54)
    const { sim } = game
    expect(sim.state.kit.stonesLeft).toBe(20)
    expect(sim.state.stone.segment).toBe(19)
    expect(sim.contextAction()).toBe('stone')
    // Skipping it costs nothing: run past, and the chance is gone for this walk.
    const frame = emptyInput()
    frame.walk = true
    hold(game, frame, 1_200)
    expect(sim.state.stone.segment).toBe(-1)
    expect(sim.contextAction()).toBeNull()
    expect(sim.state.kit.stonesLeft).toBe(20)
    expect(sim.chores.list()).toEqual([])
  })

  it("lays a stone that flattens its segment's bumps for good", () => {
    const game = walkingBack(55)
    const { sim } = game
    sim.doContext()
    expect(sim.state.stone.placing).toBe(true)
    // A drop short of the gap goes back by your feet.
    expect(sim.dropStone(0, 0)).toBe(false)
    const path = sim.state.path
    path.bumps = [50, 97]
    path.moles = [true, false]
    expect(sim.layStone()).toBe(true)
    expect(path.stones[19]).toBe(true)
    expect(sim.state.kit.stonesLeft).toBe(19)
    expect(sim.contextAction()).toBeNull()
    // The bump under the stone is gone; the other keeps its mole.
    expect(path.bumps).toEqual([50])
    expect(path.moles).toEqual([true])
    expect(sim.events).toContainEqual({
      type: 'stoneLaid',
      segment: 19,
      left: 19,
      flattened: 1
    })
  })
})
