import { describe, expect, it } from 'vitest'

import { createContainers } from './containers'
import { endingCard, endingRows, endingStats } from './ending'
import type { DrainRecord } from './replays'
import { failCard, failTitle, milestoneCard, nearMissCard } from './share'
import { makeSim, runPilot, STEP } from './testing'
import { emptyInput, type LossCause } from './types'

const CAUSES: readonly LossCause[] = [
  'drip',
  'jolt',
  'bump',
  'tilt',
  'letGo',
  'fly',
  'leaves',
  'sneeze',
  'dog',
  'ring',
  'ice',
  'wetFloor',
  'splash',
  'swat',
  'cat'
]

function noLosses(): Record<LossCause, number> {
  const out = {} as Record<LossCause, number>
  for (const cause of CAUSES) out[cause] = 0
  return out
}

describe('fail cards', () => {
  it('titles a drain like "Trip 41: lost 3 L to a fly"', () => {
    expect(failTitle(41, 3000, 'fly')).toBe('Trip 41: lost 3 L to a fly')
    expect(failTitle(7, 1400, 'dog')).toBe('Trip 7: lost 1.4 L to the dog')
    expect(failTitle(12, 800, 'letGo')).toBe(
      'Trip 12: lost 0.8 L by letting go'
    )
  })

  it('gives every cause its own phrase', () => {
    const titles = new Set(CAUSES.map(cause => failTitle(1, 1000, cause)))
    expect(titles.size).toBe(CAUSES.length)
    for (const title of titles) expect(title).not.toMatch(/undefined/)
  })

  it('carries Trip, Distance, Litres Lost and Total Lost, with where it happened', () => {
    const drain: DrainRecord = {
      cause: 'cat',
      ml: 2600,
      distance: 100,
      trip: 88,
      scene: 'house',
      walkIn: 3.6,
      pouring: false,
      container: 2,
      capacityMl: 3000,
      replay: true
    }
    const card = failCard(drain, 41_300)
    expect(card.title).toBe('Trip 88: lost 2.6 L to the cat')
    expect(card.stats.map(s => s.label)).toEqual([
      'Trip',
      'Distance',
      'Litres Lost',
      'Total Lost'
    ])
    expect(card.stats.map(s => s.value)).toEqual([88, '100 m', '2.6 L', '41 L'])
    expect(card.footer).toBe('1 step from the tub.')
    expect(card.text).toBe('Trip 88: lost 2.6 L to the cat. #WaterInASieve')
  })
})

describe('near-miss and milestone cards', () => {
  it('titles a Last Trip that fell short', () => {
    const card = nearMissCard(
      { kind: 'nearMiss', trip: 107, shortMl: 200, tubMl: 99_800 },
      12_000
    )
    expect(card.title).toBe('Trip 107: 0.2 L short.')
    expect(card.stats.map(s => s.value)).toEqual([
      107,
      '99.8 L',
      '0.2 L',
      '12 L'
    ])
    expect(card.text).toBe('Trip 107: 0.2 L short. #WaterInASieve')
  })

  it('uses the gag line for a milestone, with the time played', () => {
    const card = milestoneCard(
      {
        kind: 'milestone',
        trip: 60,
        line: '25 L. The duck floats.',
        tubMl: 25_400
      },
      9_000,
      61 * 60_000
    )
    expect(card.title).toBe('25 L. The duck floats.')
    expect(card.stats.map(s => s.label)).toEqual([
      'Trip',
      'In the Tub',
      'Total Lost',
      'Time'
    ])
    expect(card.stats[3]?.value).toBe('1:01:00')
  })
})

describe('the ending', () => {
  it('counts the cat once for drinking and tripping, and the plug apart', () => {
    const lost = noLosses()
    lost.drip = 9_000
    lost.cat = 3_000
    lost.fly = 4_000
    const containers = createContainers()
    const tub = containers[2]!
    tub.catDrunk = 7_000
    tub.plugDrained = 2_500
    const stats = endingStats({
      playedMs: 5_580_000,
      trips: 108,
      scoopedMl: 140_000,
      lostByCause: lost,
      containers,
      fliesBlown: 6,
      coins: 230,
      answer: 'Steady Hands',
      asked: true
    })
    expect(stats.lostMl).toBe(25_500)
    expect(stats.topCause).toBe('The cat')
    expect(stats.topCauseMl).toBe(10_000)
    const rows = endingRows(stats)
    expect(rows.map(r => r.label)).toEqual([
      'Time',
      'Trips',
      'Litres Scooped',
      'Litres Lost',
      'Top Cause',
      'Flies Blown Away',
      'Coins Left Over',
      'Your Interview Answer'
    ])
    expect(rows[0]?.value).toBe('1:33:00')
    expect(rows[4]?.value).toBe('The cat, 10 L')
    expect(rows[7]?.value).toBe('"Steady Hands"')
    // Picking up the interviewer without choosing an answer isn't "never picked up".
    expect(endingRows({ ...stats, answer: null })[7]?.value).toBe(
      'Said nothing'
    )
    expect(endingRows({ ...stats, answer: null, asked: false })[7]?.value).toBe(
      'Never picked up'
    )
    const card = endingCard(stats)
    expect(card.stats.map(s => `${s.label}: ${s.value}`)).toEqual([
      'Time: 1:33:00',
      'Trips: 108',
      'Litres Lost: 26 L',
      'Top Cause: The cat'
    ])
  })

  it('fills the tub from 99.5 L in one trip and plays the ending to its last frame', () => {
    const game = makeSim(4)
    const { sim } = game
    const s = sim.state
    sim.setContainer(2, 99_500)
    let ended = 0
    runPilot(
      game,
      () => {
        ended += sim.events.filter(e => e.type === 'ended').length
        sim.events.length = 0
        return s.ended
      },
      120_000
    )
    expect(s.ended).toBe(true)
    expect(ended).toBe(1)
    expect(s.containers[2]?.done).toBe(true)
    expect(s.scene).toBe('cutscene')
    expect(s.phase).toBe('ending')
    const stats = sim.endingStats()
    expect(stats.trips).toBe(1)
    expect(stats.scoopedMl).toBe(s.sieve.scooped)
    expect(stats.answer).toBeNull()
    // The game is over: nothing moves any more, and the clock has stopped.
    const frame = s.phaseMs
    const played = sim.playedMs()
    game.clock.now += 60_000
    sim.update(STEP, emptyInput())
    expect(s.phaseMs).toBe(frame)
    expect(sim.playedMs()).toBe(played)
    expect(sim.balanced()).toBe(true)
  })

  it('offers a near-miss card when a Last Trip pours and falls short', () => {
    const game = makeSim(4)
    const { sim } = game
    const s = sim.state
    sim.setContainer(2, 99_000)
    let shortMl = -1
    runPilot(game, () => {
      for (const e of sim.events) if (e.type === 'nearMiss') shortMl = e.shortMl
      sim.events.length = 0
      return s.scene === 'walkBack'
    })
    expect(s.current.lastTrip).toBe(true)
    expect(shortMl).toBeGreaterThan(0)
    expect(s.share).toMatchObject({ kind: 'nearMiss', shortMl })
    expect(sim.lastTripLabel()).toBe('really')
  })

  it('offers a milestone card after the 25 L gag', () => {
    const game = makeSim(4)
    const { sim } = game
    const s = sim.state
    sim.setContainer(2, 24_500)
    runPilot(game, () => s.scene === 'cutscene')
    expect(s.phase).toBe('duck')
    expect(s.share).toMatchObject({
      kind: 'milestone',
      line: '25 L. The duck floats.'
    })
    runPilot(game, () => s.scene === 'walkBack', 10_000)
    expect(s.share?.kind).toBe('milestone')
  })
})
