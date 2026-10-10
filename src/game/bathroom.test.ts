import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import {
  createEvent,
  rollBathroomThreat,
  stepEvent,
  type CarryEvent
} from './events'
import { makeSim, runPilot, STEP, type TestGame } from './testing'

/** Steps an event with a fixed speed until it resolves; returns every outcome. */
function play(event: CarryEvent, speed: number): string[] {
  const outcomes: string[] = []
  for (let t = 0; t < 10_000 && event.stage === 'warning'; t += STEP) {
    const outcome = stepEvent(event, {
      dtMs: STEP,
      blow: false,
      speed,
      total: 0.05
    })
    if (outcome !== 'none') outcomes.push(outcome)
  }
  return outcomes
}

/** A bathtub-phase game carrying its first scoop 20 m out. */
function tubCarry(seed: number, litres = 30): TestGame {
  const game = makeSim(seed)
  game.sim.setContainer(2, litres * 1_000)
  runPilot(game, () => game.sim.state.walker.distance > 20)
  return game
}

describe('the cat round your ankles', () => {
  it('trips you if you keep walking, and gets bored if you stand still', () => {
    const walking = createEvent('catAnkles', 1, rng(1))
    walking.stage = 'warning'
    expect(play(walking, 1)).toEqual(['tripped'])
    expect(walking.ms).toBeGreaterThanOrEqual(1_200)

    const still = createEvent('catAnkles', 1, rng(1))
    still.stage = 'warning'
    expect(play(still, 0)).toEqual([
      'rubbed',
      'rubbed',
      'rubbed',
      'rubbed',
      'passed'
    ])
  })
})

describe('the bathroom slot', () => {
  it('rolls a threat on about 15% of trips, and always when guaranteed', () => {
    const random = rng(3)
    let threats = 0
    for (let i = 0; i < 4_000; i++)
      if (rollBathroomThreat(random, false)) threats++
    expect(threats / 4_000).toBeCloseTo(0.15, 1)
    for (let i = 0; i < 20; i++) {
      const threat = rollBathroomThreat(random, true)
      expect(threat?.bathroom).toBe(true)
      expect(threat?.at).toBeLessThanOrEqual(2)
      if (threat?.id === 'catAnkles') expect(threat.at).toBe(0)
    }
    for (let i = 0; i < 40; i++)
      expect(rollBathroomThreat(random, true, false)?.id).not.toBe('catAnkles')
  })

  it('always sends something after you on Last Trip, and no carry event', () => {
    for (const seed of [61, 62, 63]) {
      const game = makeSim(seed)
      const { sim } = game
      sim.setContainer(2, 99_500)
      sim.state.trip = 30
      runPilot(game, () => sim.state.scene === 'path')
      expect(sim.state.current.lastTrip).toBe(true)
      expect(sim.state.event).toBeNull()
      runPilot(game, () => sim.state.scene === 'house')
      expect(sim.state.event?.bathroom).toBe(true)
    }
  })

  it('never follows a trip that already had a carry event', () => {
    const game = tubCarry(64)
    const { sim } = game
    sim.triggerEvent('sneeze')
    runPilot(game, () => sim.state.scene === 'house')
    expect(sim.state.event?.id).toBe('sneeze')
    expect(sim.state.event?.bathroom).toBe(false)
  })

  it('lands a fly through the door mid-pour, and the poured water still pays', () => {
    const game = tubCarry(65)
    const { sim } = game
    sim.triggerBathroom('fly')
    const coins = sim.wallet.coins()
    runPilot(
      game,
      () => sim.state.phase === 'drained' || sim.state.phase === 'poured',
      30_000,
      frame => {
        frame.blow = false
      },
      { pourOffset: 30 }
    )
    expect(sim.state.lastDrain?.cause).toBe('fly')
    expect(sim.state.lastDrain?.scene).toBe('house')
    expect(sim.state.current.deliveredMl).toBeGreaterThan(0)
    expect(sim.wallet.coins()).toBeGreaterThan(coins)
    expect(sim.balanced()).toBe(true)
  })

  it('blowing mid-pour drives the fly off', () => {
    const game = tubCarry(66)
    const { sim } = game
    sim.triggerBathroom('fly')
    runPilot(game, () => sim.state.phase === 'poured', 60_000, undefined, {
      pourOffset: 30
    })
    expect(sim.state.phase).toBe('poured')
    expect(sim.state.event?.outcome).toBe('countered')
    expect(sim.state.stats.drains).toBe(0)
  })

  it('trips you on the walk-in if you keep walking with the cat at your feet', () => {
    const game = tubCarry(67)
    const { sim } = game
    sim.triggerBathroom('catAnkles')
    runPilot(
      game,
      () => sim.state.phase === 'drained' || sim.state.phase === 'pour',
      30_000,
      frame => {
        if (sim.state.scene === 'house') frame.walk = true
      }
    )
    expect(sim.state.lastDrain?.cause).toBe('cat')

    const careful = tubCarry(68)
    careful.sim.triggerBathroom('catAnkles')
    runPilot(careful, () => careful.sim.state.phase === 'poured')
    expect(careful.sim.state.stats.drains).toBe(0)
  })

  it('makes a sneeze come during the pour unless your hands are still', () => {
    /** Pours slowly and sends a bath-dust sneeze once the pour starts. */
    const sneezeInPour = (seed: number, handAccel: number) => {
      const game = tubCarry(seed)
      const { sim } = game
      runPilot(game, () => sim.state.phase === 'pour', 30_000, undefined, {
        pourOffset: 25
      })
      sim.triggerBathroom('sneeze')
      const event = sim.state.event
      if (event) event.fake = false
      runPilot(
        game,
        () => sim.state.phase === 'drained' || sim.state.phase === 'poured',
        30_000,
        frame => {
          frame.handAccel = handAccel
        },
        { pourOffset: 25 }
      )
      return sim
    }
    expect(sneezeInPour(69, 3_000).state.lastDrain?.cause).toBe('sneeze')
    expect(sneezeInPour(70, 250).state.stats.drains).toBe(0)
  })

  it('slips you on a wet house floor at a walk, but not on tiptoe', () => {
    const rushed = tubCarry(71)
    rushed.sim.state.house.floorPatch = true
    runPilot(
      rushed,
      () =>
        rushed.sim.state.phase === 'drained' ||
        rushed.sim.state.phase === 'pour',
      30_000,
      frame => {
        if (rushed.sim.state.scene === 'house') frame.walk = true
      }
    )
    expect(rushed.sim.state.lastDrain?.cause).toBe('wetFloor')

    const careful = tubCarry(72)
    careful.sim.state.house.floorPatch = true
    runPilot(careful, () => careful.sim.state.phase === 'poured')
    expect(careful.sim.state.stats.drains).toBe(0)
  })
})
