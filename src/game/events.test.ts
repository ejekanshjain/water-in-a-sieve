import { afterEach, describe, expect, it } from 'vitest'

import { rng, settings } from '../shared'
import {
  createEvent,
  eventChances,
  rollCarryEvent,
  stepEvent,
  type CarryEvent,
  type CarryEventId,
  type EventInput
} from './events'
import { makeSim, runPilot, STEP, type TestGame } from './testing'

afterEach(() => settings.set({ assist: false, sensitivity: 1 }))

/** Starts an event's warning, as the sim does when you reach its spot. */
function warning(id: CarryEventId, seed = 1): CarryEvent {
  const event = createEvent(id, 20, rng(seed))
  event.stage = 'warning'
  return event
}

/** Steps an event with a fixed input until it resolves; returns every outcome on the way. */
function play(event: CarryEvent, input: Omit<EventInput, 'dtMs'>): string[] {
  const outcomes: string[] = []
  for (let t = 0; t < 20_000 && event.stage === 'warning'; t += STEP) {
    const outcome = stepEvent(event, { ...input, dtMs: STEP })
    if (outcome !== 'none') outcomes.push(outcome)
  }
  return outcomes
}

/** Carries the first scoop 20 m out, then starts an event. */
function carrying(seed: number, id: CarryEventId): TestGame {
  const game = makeSim(seed)
  runPilot(game, () => game.sim.state.walker.distance > 20)
  game.sim.triggerEvent(id)
  return game
}

const STILL = { blow: false, speed: 0, total: 0.05 }
const WALKING = { blow: false, speed: 4, total: 0.2 }

describe('carry event chances', () => {
  const every = new Set<CarryEventId>(['fly', 'leaf', 'sneeze', 'dog', 'ring'])

  it('roll nothing before trip 6, and only events that are built', () => {
    const leafOnly = new Set<CarryEventId>(['leaf'])
    const ctx = { season: 'autumn' as const, lastTrip: {} }
    expect(eventChances({ ...ctx, trip: 5, available: every })).toEqual([])
    expect(eventChances({ ...ctx, trip: 6, available: leafOnly })).toEqual([
      ['leaf', 0.12]
    ])
  })

  it('keep an event away for 2 trips after it happens', () => {
    const ctx = {
      season: 'autumn' as const,
      available: new Set<CarryEventId>(['leaf']),
      lastTrip: { leaf: 10 }
    }
    expect(eventChances({ ...ctx, trip: 12 })).toEqual([])
    expect(eventChances({ ...ctx, trip: 13 })).toEqual([['leaf', 0.12]])
  })

  it('never add up to more than 60% in any season', () => {
    for (const season of ['summer', 'autumn', 'winter', 'spring'] as const) {
      const chances = eventChances({
        trip: 20,
        season,
        available: every,
        lastTrip: {}
      })
      const total = chances.reduce((sum, [, c]) => sum + c, 0)
      expect(total).toBeGreaterThan(0)
      expect(total).toBeLessThanOrEqual(0.6 + 1e-9)
    }
  })

  it('repeat for the same seed', () => {
    const ctx = {
      trip: 9,
      season: 'summer' as const,
      available: new Set<CarryEventId>(['fly', 'sneeze']),
      lastTrip: {}
    }
    const roll = (seed: number) => {
      const random = rng(seed)
      return Array.from({ length: 20 }, () => rollCarryEvent(ctx, random)).map(
        e => e && [e.id, e.at.toFixed(2)]
      )
    }
    expect(roll(5)).toEqual(roll(5))
    expect(roll(5).filter(Boolean).length).toBeGreaterThan(2)
  })

  it('warn at least 1.2s before they can hurt', () => {
    const ids = ['leaf', 'fly', 'sneeze', 'dog', 'ring', 'catAnkles'] as const
    for (const id of ids)
      for (let seed = 1; seed < 30; seed++) {
        const event = createEvent(id, 20, rng(seed))
        expect(event.warnMs).toBeGreaterThanOrEqual(1200)
        if (id === 'leaf' || id === 'fly')
          expect(event.shadowMs).toBeGreaterThanOrEqual(1200)
      }
  })
})

describe('the fly', () => {
  it('lands and drains when ignored, after circling and its shadow', () => {
    const fly = warning('fly')
    expect(play(fly, WALKING)).toEqual(['landed'])
    expect(fly.ms).toBeGreaterThanOrEqual(4200 - STEP)
  })

  it('retreats from a blow, comes back faster, and gives up after 2 blows', () => {
    const fly = warning('fly')
    const outcomes: string[] = []
    for (let t = 0; t < 20_000 && fly.stage === 'warning'; t += STEP) {
      // Blow only once each dive's shadow shows.
      const diving = fly.retreatMs <= 0 && fly.ms >= fly.warnMs - fly.shadowMs
      const outcome = stepEvent(fly, { ...STILL, blow: diving, dtMs: STEP })
      if (outcome !== 'none') outcomes.push(outcome)
    }
    expect(outcomes).toEqual(['blown', 'returned', 'gaveUp'])
    expect(fly.outcome).toBe('countered')
    expect(fly.warnMs).toBeLessThan(4200)
  })
})

describe('the swatter', () => {
  it('kills a fly or a falling leaf in one swing', () => {
    for (const id of ['fly', 'leaf'] as const) {
      const event = warning(id)
      stepEvent(event, { ...WALKING, dtMs: STEP })
      expect(stepEvent(event, { ...WALKING, swat: true, dtMs: STEP })).toBe(
        'swatted'
      )
      expect(event.outcome).toBe('countered')
    }
  })

  it('misses a fly zooming off after a blow', () => {
    const event = warning('fly')
    while (stepEvent(event, { ...STILL, blow: true, dtMs: STEP }) !== 'blown');
    expect(event.retreatMs).toBeGreaterThan(0)
    expect(stepEvent(event, { ...STILL, swat: true, dtMs: STEP })).toBe('none')
    expect(event.stage).toBe('warning')
  })

  it('does nothing for a sneeze', () => {
    const event = warning('sneeze')
    expect(stepEvent(event, { ...STILL, swat: true, dtMs: STEP })).toBe('none')
    expect(event.stage).toBe('warning')
  })
})

describe('the sneeze', () => {
  it('drains while you walk and passes when you freeze', () => {
    const real = (seed: number) => {
      for (let s = seed; s < seed + 50; s++) {
        const event = warning('sneeze', s)
        if (!event.fake) return event
      }
      throw new Error('no real sneeze')
    }
    expect(play(real(1), WALKING)).toEqual(['sneezed'])
    expect(play(real(1), STILL)).toEqual(['heldIn'])
    // Standing still with shaky hands still counts as moving.
    expect(play(real(1), { ...STILL, total: 0.4 })).toEqual(['sneezed'])
  })

  it('comes between 1.8s and 2.6s, and about 1 in 10 never comes', () => {
    let fakes = 0
    for (let seed = 1; seed <= 400; seed++) {
      const event = warning('sneeze', seed)
      expect(event.warnMs).toBeGreaterThanOrEqual(1800)
      expect(event.warnMs).toBeLessThanOrEqual(2600)
      if (event.fake) {
        fakes++
        expect(play(event, WALKING)).toEqual(['neverMind'])
      }
    }
    expect(fakes).toBeGreaterThan(20)
    expect(fakes).toBeLessThan(65)
  })
})

describe('events in the sim', () => {
  it('drains with cause fly when you ignore the fly', () => {
    const game = carrying(60, 'fly')
    const { sim } = game
    runPilot(
      game,
      () => sim.state.phase === 'drained',
      8000,
      frame => {
        frame.blow = false
      }
    )
    expect(sim.state.lastDrain?.cause).toBe('fly')
    expect(sim.balanced()).toBe(true)
  })

  it('counts a fly blown away, and the autopilot keeps its water', () => {
    const game = carrying(61, 'fly')
    const { sim } = game
    runPilot(game, () => sim.state.phase === 'poured', 60_000)
    expect(sim.state.stats.fliesBlown).toBe(1)
    expect(sim.state.stats.drains).toBe(0)
    expect(sim.state.hintsDone.fly).toBe(true)
  })

  it('drains a sneeze while walking, even in Assist Mode at Sensitivity 0.5', () => {
    settings.set({ assist: true, sensitivity: 0.5 })
    for (let seed = 62; seed < 70; seed++) {
      const game = carrying(seed, 'sneeze')
      const { sim } = game
      if (sim.state.queuedEvent?.fake || sim.state.event?.fake) continue
      runPilot(
        game,
        () => sim.state.event?.stage === 'over',
        5000,
        frame => {
          frame.walk = true
        }
      )
      expect(sim.state.lastDrain?.cause).toBe('sneeze')
      return
    }
    throw new Error('every seed was a fake-out')
  })

  it('lets the autopilot freeze through a sneeze', () => {
    for (let seed = 70; seed < 80; seed++) {
      const game = carrying(seed, 'sneeze')
      const { sim } = game
      if (sim.state.event?.fake) continue
      runPilot(game, () => sim.state.event?.stage === 'over', 5000)
      expect(sim.state.event?.outcome).toBe('countered')
      expect(sim.state.stats.drains).toBe(0)
      return
    }
    throw new Error('every seed was a fake-out')
  })
})

describe('the dog', () => {
  it('trips you while you walk and runs between your legs when you stop', () => {
    expect(play(warning('dog'), WALKING)).toEqual(['tripped'])
    expect(play(warning('dog'), { ...WALKING, speed: 0.4 })).toEqual(['passed'])
  })

  it('drains the sieve with cause dog in the sim', () => {
    const game = carrying(81, 'dog')
    const { sim } = game
    runPilot(
      game,
      () => sim.state.event?.stage === 'over',
      5000,
      frame => {
        frame.walk = true
      }
    )
    expect(sim.state.lastDrain?.cause).toBe('dog')
  })
})

describe('phone calls', () => {
  it('ring from trip 12 only', () => {
    const ctx = {
      season: 'winter' as const,
      available: new Set<CarryEventId>(['ring']),
      lastTrip: {}
    }
    expect(eventChances({ ...ctx, trip: 11 })).toEqual([])
    expect(eventChances({ ...ctx, trip: 12 })).toEqual([['ring', 0.08]])
  })

  it('buzz in your pocket when ignored, then ring out', () => {
    const call = warning('ring')
    const outcomes = play(call, WALKING)
    expect(outcomes.filter(o => o === 'buzz')).toHaveLength(6)
    expect(outcomes.at(-1)).toBe('ignored')
  })

  it('pulse the ring while ignored, enough to slosh', () => {
    const game = carrying(82, 'ring')
    const { sim } = game
    let peak = 0
    runPilot(
      game,
      () => sim.state.event?.stage === 'over',
      7000,
      frame => {
        frame.answer = false
        frame.walk = false
        peak = Math.max(peak, sim.state.steady.body)
      }
    )
    expect(peak).toBeGreaterThan(0.3)
  })

  it('stop you for 5s while you listen', () => {
    const game = carrying(83, 'ring')
    const { sim } = game
    runPilot(game, () => sim.state.event?.stage === 'warning', 1000)
    expect(sim.answerCall()).toBe(true)
    runPilot(
      game,
      () => false,
      3000,
      frame => {
        frame.walk = true
      }
    )
    expect(sim.state.walker.speed).toBe(0)
    runPilot(game, () => sim.state.event?.stage === 'over', 3000)
    expect(sim.state.event?.outcome).toBe('countered')
  })

  it('make Mum call back after you decline, and pay 60 coins when you answer', () => {
    const game = makeSim(84)
    const { sim } = game
    // The second caller in turn is Mum.
    sim.state.calls.next = 1
    runPilot(game, () => sim.state.walker.distance > 20)
    sim.triggerEvent('ring')
    expect(sim.state.event?.caller).toBe('mum')
    runPilot(game, () => sim.state.event?.stage === 'warning', 1000)
    expect(sim.declineCall()).toBe(true)
    expect(sim.state.calls.callback).toBe('mum')
    // Next trip she rings again.
    runPilot(game, () => sim.state.trip === 2, 120_000)
    expect(sim.state.event?.id).toBe('ring')
    expect(sim.state.event?.caller).toBe('mum')
    const coins = sim.wallet.coins()
    runPilot(game, () => sim.state.event?.stage === 'warning', 60_000)
    expect(sim.answerCall()).toBe(true)
    expect(sim.wallet.coins()).toBe(coins + 60)
  })

  it('keep your interview answer for the ending', () => {
    const game = carrying(85, 'ring')
    const { sim } = game
    expect(sim.state.event?.caller).toBe('interviewer')
    runPilot(game, () => sim.state.event?.stage === 'warning', 1000)
    sim.answerCall()
    expect(sim.contextAction()).toBe('interview')
    expect(sim.chooseAnswer('f')).toBe(true)
    expect(sim.state.calls.answer).toBe('Carrying Things')
    expect(sim.chooseAnswer('e')).toBe(false)
  })

  it('let the scam ring twice in a row', () => {
    const game = makeSim(86)
    const { sim } = game
    sim.state.calls.next = 2
    runPilot(game, () => sim.state.walker.distance > 20)
    sim.triggerEvent('ring')
    expect(sim.state.event?.caller).toBe('scam')
    runPilot(game, () => sim.state.event?.stage === 'warning', 1000)
    sim.declineCall()
    expect(sim.state.calls.callback).toBe('scam')
    runPilot(game, () => sim.state.trip === 2, 120_000)
    expect(sim.state.event?.caller).toBe('scam')
  })
})
