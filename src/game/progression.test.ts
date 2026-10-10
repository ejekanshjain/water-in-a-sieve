import { describe, expect, it } from 'vitest'

import { createHudStore, SnapshotPublisher } from './snapshot'
import { hold, makeSim, runPilot, STEP, type TestGame } from './testing'
import { HOLE_LEAK_ML_PER_S } from './tuning'
import { emptyInput } from './types'

/** Plays one full trip with the autopilot, through any cutscene, back to the well. */
function oneTrip(game: TestGame) {
  const s = game.sim.state
  const trip = s.trip
  runPilot(game, () => s.trip > trip && s.scene === 'well', 200_000)
}

describe('containers and progression', () => {
  it('finishes the bucket: +150 coins, the kick cutscene, then the sink in autumn', () => {
    const game = makeSim(50)
    const { sim } = game
    const s = sim.state
    sim.setContainer(0, 9_500)
    runPilot(game, () => s.phase === 'poured')
    const delivered = s.current.deliveredMl
    expect(s.containers[0]?.done).toBe(true)
    expect(s.containerIndex).toBe(1)
    expect(s.season).toBe('autumn')
    expect(sim.wallet.coins()).toBe(
      Math.round((delivered * 30) / 1000) + 30 + 150
    )
    // The HUD stays on the full bucket while the pour's result shows.
    const hud = createHudStore()
    new SnapshotPublisher(hud).publish(sim, 'mouse', true)
    expect(hud.get().containerName).toBe('Bucket')
    expect(hud.get().containerTenths).toBe(100)
    runPilot(game, () => s.scene === 'cutscene')
    expect(s.phase).toBe('bucketDone')
    runPilot(game, () => s.scene !== 'cutscene', 10_000)
    expect(s.scene).toBe('well')
    // The sink path has the rose bush and four bumps.
    runPilot(game, () => s.scene === 'path')
    expect(s.path.rose).toBe(true)
    expect(s.path.bumps).toHaveLength(4)
    expect(sim.balanced()).toBe(true)
  })

  it('finishes the sink: +300 coins and the bathtub', () => {
    const game = makeSim(51)
    const { sim } = game
    const s = sim.state
    sim.setContainer(1, 19_500)
    expect(s.season).toBe('autumn')
    runPilot(game, () => s.phase === 'poured')
    expect(s.containers[1]?.done).toBe(true)
    expect(s.containerIndex).toBe(2)
    expect(sim.wallet.coins()).toBeGreaterThanOrEqual(300)
    runPilot(game, () => s.scene === 'cutscene')
    expect(s.phase).toBe('sinkDone')
    runPilot(game, () => s.scene === 'well', 10_000)
    expect(s.season).toBe('autumn')
  })

  it('turns winter at 15 L in the tub and spring at 60 L', () => {
    const game = makeSim(52)
    const { sim } = game
    const s = sim.state
    sim.setContainer(2, 14_500)
    oneTrip(game)
    expect(s.season).toBe('winter')
    expect(sim.crankCircles()).toBe(6)
    sim.setContainer(2, 59_500)
    oneTrip(game)
    expect(s.season).toBe('spring')
    expect(sim.crankCircles()).toBe(5)
  })

  it('plays the duck gag at 25 L, then runs home from the house', () => {
    const game = makeSim(53)
    const { sim } = game
    const s = sim.state
    sim.setContainer(2, 24_500)
    runPilot(game, () => s.scene === 'cutscene')
    expect(s.phase).toBe('duck')
    expect(s.milestonesShown).toBe(1)
    runPilot(game, () => s.scene !== 'cutscene', 10_000)
    expect(s.scene).toBe('walkBack')
    expect(s.walker.distance).toBeGreaterThan(98)
    expect(s.tripReport).toMatch(/The bathtub is 25% full\.$/)
  })

  it('needs 6 crank circles in winter', () => {
    const { sim } = makeSim(54)
    sim.setSeason('winter')
    for (let i = 0; i < 5; i++) sim.crankCircle(1, 800)
    expect(sim.state.well.bucketUp).toBe(false)
    sim.crankCircle(1, 800)
    expect(sim.state.well.bucketUp).toBe(true)
  })
})

describe('the rose bush and holes', () => {
  it('tears one hole when you rush past the rose bush, and none when you go slowly', () => {
    const game = makeSim(55)
    const { sim } = game
    const s = sim.state
    sim.setContainer(1, 0)
    runPilot(game, () => s.scene === 'path')
    // Line up a rush through the thorns with no bumps in the way.
    s.path.bumps = []
    s.walker.distance = 55
    s.walker.speed = 4.5
    runPilot(
      game,
      () => s.walker.distance > 63 || s.phase !== 'carry',
      20_000,
      frame => {
        frame.walk = true
      }
    )
    expect(s.holes).toHaveLength(1)
    expect(s.hintsDone.rose).toBe(true)
    expect(s.current.noDrip).not.toBe('intact')

    const careful = makeSim(56)
    careful.sim.setContainer(1, 0)
    runPilot(careful, () => careful.sim.state.phase === 'poured')
    expect(careful.sim.state.current.maxDistance).toBeGreaterThanOrEqual(100)
    expect(careful.sim.state.holes).toHaveLength(0)
  })

  it('leaks 0.05 L/s per hole while you carry', () => {
    const leakOver = (holes: number) => {
      const game = makeSim(57)
      const s = game.sim.state
      runPilot(game, () => s.scene === 'path')
      game.sim.addHoles(holes)
      const before = s.sieve.inSieve
      const frame = emptyInput()
      frame.grip = true
      frame.x = s.grip.x
      frame.y = s.grip.y
      hold(game, frame, 4000)
      return before - s.sieve.inSieve
    }
    const extra = leakOver(2) - leakOver(0)
    expect(extra).toBeGreaterThan(2 * HOLE_LEAK_ML_PER_S * 4 * 0.9)
    expect(extra).toBeLessThan(2 * HOLE_LEAK_ML_PER_S * 4 * 1.1)
  })

  it('ends the trip when holes leak the sieve dry before the house', () => {
    const game = makeSim(60)
    const s = game.sim.state
    runPilot(game, () => s.scene === 'path')
    game.sim.addHoles(3)
    runPilot(game, () => s.scene === 'walkBack', 60_000)
    expect(s.scene).toBe('walkBack')
    expect(s.current.maxDistance).toBeLessThan(100)
    expect(s.sieve.inSieve).toBe(0)
    expect(game.sim.balanced()).toBe(true)
  })
})

describe('Last Trip', () => {
  it('labels the final sieve, and says Really after one falls short', () => {
    const game = makeSim(58)
    const { sim } = game
    const s = sim.state
    sim.setContainer(2, 99_000)
    expect(sim.lastTripLabel()).toBe('last')
    runPilot(game, () => s.scene === 'path')
    expect(s.current.lastTrip).toBe(true)
    expect(sim.events.some(e => e.type === 'lastTrip')).toBe(true)
    runPilot(game, () => s.scene === 'walkBack')
    expect(s.tripReport).toMatch(/^99\.\d L\. So close\.$/)
    expect(sim.lastTripLabel()).toBe('really')
  })

  it('stays No for every container but the bathtub', () => {
    const { sim } = makeSim(59)
    sim.setContainer(0, 9_500)
    expect(sim.lastTripLabel()).toBe('no')
    sim.update(STEP, emptyInput())
    expect(sim.lastTripLabel()).toBe('no')
  })
})
