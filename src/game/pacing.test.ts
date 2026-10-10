import { describe, expect, it } from 'vitest'

import type { SkillName } from './autopilot'
import {
  estimateMinutes,
  phaseRates,
  playGame,
  type GameRun,
  type TripSample
} from './pacing'

/** Whole seeded games per player; each one takes under a second of test time. */
const SEEDS = [1, 2, 3, 4]
const played = new Map<string, GameRun[]>()

function games(name: SkillName, assist = false): GameRun[] {
  const key = `${name}:${assist}`
  let runs = played.get(key)
  if (!runs) {
    runs = SEEDS.map(seed => playGame(name, seed, { assist }))
    played.set(key, runs)
  }
  return runs
}

function meanMinutes(runs: readonly GameRun[]): number {
  let total = 0
  for (const run of runs) total += estimateMinutes(run)
  return total / runs.length
}

/** Share of all trips in `runs` that failed. */
function failRate(runs: readonly GameRun[]): number {
  let trips = 0
  let fails = 0
  for (const run of runs)
    for (const sample of run.trips) {
      trips++
      if (sample.failed) fails++
    }
  return fails / trips
}

function trip(container: number, failed: boolean): TripSample {
  return {
    container,
    capacityMl: 1000,
    scoopedMl: 1000,
    deliveredMl: failed ? 0 : 800,
    failed,
    drainM: failed ? 40 : -1,
    cause: failed ? 'jolt' : null,
    ms: failed ? 20_000 : 40_000
  }
}

describe('pacing arithmetic', () => {
  it('groups trips by container and sieve size into rates', () => {
    const run = {
      trips: [trip(0, false), trip(0, true), trip(0, false), trip(1, false)]
    } as GameRun
    const [bucket, sink] = phaseRates([run])
    expect(bucket?.trips).toBe(3)
    expect(bucket?.successRate).toBeCloseTo(2 / 3)
    expect(bucket?.deliveredShare).toBeCloseTo(0.8)
    expect(bucket?.failS).toBe(20)
    expect(bucket?.drainM).toBe(40)
    expect(sink?.successRate).toBe(1)
  })

  it('adds the start, the shop, replays and hints to the simulated time', () => {
    const run = { simMs: 60 * 60_000, purchases: 3, replays: 6, hints: 20 }
    // 60 min, plus 60s start, 3 x 20s shopping, 6 x 10s replays, 20 x 3s hints.
    expect(estimateMinutes(run as GameRun)).toBe(64)
  })
})

describe('pacing of whole seeded games', () => {
  it('takes an average player 60 to 120 minutes', () => {
    const runs = games('average')
    for (const run of runs) expect(run.ended).toBe(true)
    const minutes = meanMinutes(runs)
    expect(minutes).toBeGreaterThan(60)
    expect(minutes).toBeLessThan(120)
  }, 30_000)

  it('takes an unskilled player over 120 minutes, but they still finish', () => {
    const runs = games('unskilled')
    for (const run of runs) expect(run.ended).toBe(true)
    expect(meanMinutes(runs)).toBeGreaterThan(120)
  }, 30_000)

  it('fails the unskilled player more often in every container', () => {
    const rates = (name: SkillName) => {
      const success = [0, 0, 0]
      const trips = [0, 0, 0]
      for (const run of games(name))
        for (const sample of run.trips) {
          const i = sample.container
          trips[i] = (trips[i] ?? 0) + 1
          if (!sample.failed) success[i] = (success[i] ?? 0) + 1
        }
      return success.map((wins, i) => wins / (trips[i] ?? 1))
    }
    const average = rates('average')
    const unskilled = rates('unskilled')
    for (let i = 0; i < 3; i++)
      expect(unskilled[i] ?? 1).toBeLessThan(average[i] ?? 0)
  }, 30_000)

  it('keeps the cat and the plug to a few litres a game', () => {
    for (const run of games('average'))
      expect(run.catMl + run.plugMl).toBeLessThan(8000)
  }, 30_000)

  it('fails an unskilled player in Assist Mode about as often as an average one without it', () => {
    const unskilled = failRate(games('unskilled', true))
    expect(unskilled).toBeGreaterThan(0.2)
    expect(unskilled).toBeLessThan(0.35)
    expect(Math.abs(unskilled - failRate(games('average')))).toBeLessThan(0.08)
    // An average player in Assist Mode still fails about one trip in eight.
    const average = failRate(games('average', true))
    expect(average).toBeGreaterThan(0.08)
    expect(average).toBeLessThan(0.18)
  }, 30_000)

  it('speeds up an unskilled player in Assist Mode, and still takes an hour', () => {
    const assisted = games('unskilled', true)
    expect(meanMinutes(assisted)).toBeLessThan(meanMinutes(games('unskilled')))
    expect(meanMinutes(games('average', true))).toBeGreaterThan(60)
  }, 30_000)
})
