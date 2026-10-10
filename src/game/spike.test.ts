import { describe, expect, it } from 'vitest'

import {
  checks,
  createTipCount,
  CURRENT_PHONE,
  feedTip,
  measure,
  percentile,
  readingsText,
  suggest,
  suggestedNumbers,
  type SpikeSample,
  type SpikeStageId,
  type SpikeTake,
  type SpikeTakes
} from './spike'
import { parseTune, tuneValue } from './tune'

const FRAME = 1000 / 60

/** A seeded wobble from 0 to 1, so takes repeat exactly. */
function wobble(seed: number): () => number {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }
}

/** A smoothed jolt bump at `at` ms: a 50 ms rise to `peak`, then a 70 ms decay. */
function bump(t: number, at: number, peak: number): number {
  const d = t - at
  if (d < 0) return 0
  if (d < 50) return (peak * d) / 50
  return peak * Math.exp(-(d - 50) / 70)
}

/** A take sampled at 60 Hz: a quiet base plus bumps, with touches and forward tilt. */
function take(
  stage: SpikeStageId,
  ms: number,
  bumps: [number, number][],
  options: {
    touches?: number[]
    tiltY?: (t: number) => number
    tappedDone?: boolean
    base?: number
  } = {}
): SpikeTake {
  const noise = wobble(stage.length * 7919)
  const base = options.base ?? 0.03
  const samples: SpikeSample[] = []
  for (let t = 0; t <= ms; t += FRAME) {
    let jolt = base + noise() * 0.02
    for (const [at, peak] of bumps) jolt += bump(t, at, peak)
    samples.push({ t, jolt, tiltX: 0, tiltY: options.tiltY?.(t) ?? 0 })
  }
  return {
    stage,
    samples,
    touches: options.touches ?? [],
    tappedDone: options.tappedDone ?? false
  }
}

/** `count` steps every `everyMs` from 500 ms, peaking at `peak` give or take `spread`. */
function steps(count: number, peak: number, spread = 0, everyMs = 550) {
  const vary = wobble(count * 31 + Math.round(peak * 100))
  return Array.from({ length: count }, (_, i): [number, number] => [
    500 + i * everyMs,
    peak + (vary() * 2 - 1) * spread
  ])
}

/** A whole spike from a phone with clear gaps between standing, walking and stomping. */
function session(): SpikeTakes {
  const presses: number[] = []
  const pressBumps: [number, number][] = []
  for (let i = 0; i < 8; i++) {
    const down = 500 + i * 1500
    presses.push(down, down + 900)
    pressBumps.push([down, 0.5], [down + 900, 0.4])
  }
  const stomps = steps(30, 1.4, 0.15)
  for (const i of [5, 10, 15, 20, 25]) {
    const step = stomps[i]
    if (step) step[1] = 4
  }
  return {
    still: take('still', 8000, []),
    presses: take('presses', 13000, pressBumps, { touches: presses }),
    scoops: take('scoops', 12000, [], {
      base: 0.08,
      tiltY: t => -32 * Math.max(0, Math.sin((t / 2400) * Math.PI * 2))
    }),
    knocks: take('knocks', 10000, [
      [1000, 6],
      [3000, 5.5],
      [5000, 7],
      [7000, 6.5],
      [9000, 5]
    ]),
    slow: take('slow', 20 * 900 + 1500, steps(20, 1.1, 0.1, 900), {
      tappedDone: true
    }),
    tiptoe: take('tiptoe', 20 * 1100 + 1500, steps(20, 0.8, 0.1, 1100), {
      tappedDone: true
    }),
    walk: take('walk', 50 * 550 + 1500, steps(50, 1.5, 0.2), {
      tappedDone: true
    }),
    stomps: take('stomps', 30 * 550 + 1500, stomps, { tappedDone: true })
  }
}

describe('the spike recorder', () => {
  it('suggests numbers that pass every check on a clear session', () => {
    const takes = session()
    const suggestions = suggest(takes)
    const next = suggestedNumbers(suggestions)
    const rows = checks(takes, CURRENT_PHONE, next)
    for (const row of rows) expect(row.nextOk, row.label).toBe(true)
    expect(suggestions.every(s => !s.warning)).toBe(true)
    const r = measure(takes, next)
    expect(r.steps.map(s => s.counted)).toEqual([20, 20, 50])
    expect(r.standingSteps).toBe(0)
    // Gentle steps sit between the tiptoe and the stomps.
    expect(next.GENTLE_STEP_JOLT).toBeGreaterThan(1.4)
    expect(next.GENTLE_STEP_JOLT).toBeLessThan(2.5)
    expect(next.REAL_STRIDE_M).toBe(2)
  })

  it('needs grace only when thumb presses shake the phone', () => {
    const takes = session()
    const shaky = suggestedNumbers(suggest(takes))
    expect(shaky.TOUCH_GRACE_MS).toBeGreaterThan(0)
    expect(shaky.TOUCH_GRACE_SCALE).toBeLessThan(1)
    const calm = take('presses', 13000, [], { touches: [500, 1400, 2000] })
    const off = suggestedNumbers(suggest({ still: takes.still, presses: calm }))
    expect(off.TOUCH_GRACE_MS).toBe(0)
    expect(off.TOUCH_GRACE_SCALE).toBe(1)
  })

  it('stretches the stride when the walk counts fewer steps than you took', () => {
    const takes = session()
    // 10 of the 50 steps are too soft to count at any threshold that ignores standing.
    const soft = steps(50, 1.5, 0.2).map(([at, peak], i): [number, number] => [
      at,
      i % 5 === 0 ? 0.02 : peak
    ])
    takes.walk = take('walk', 50 * 550 + 1500, soft, { tappedDone: true })
    const next = suggestedNumbers(suggest(takes))
    expect(next.REAL_STRIDE_M).toBe(2.5)
  })

  it('keeps the current numbers for takes not recorded yet', () => {
    const suggestions = suggest({})
    for (const s of suggestions) {
      expect(s.value).toBe(s.now)
      expect(s.why).toMatch(/^Needs /)
    }
    expect(suggestions).toHaveLength(9)
  })

  it('warns when knocks read softer than careful moves', () => {
    const takes = session()
    takes.knocks = take('knocks', 10000, [[2000, 0.3]])
    const ref = suggest(takes).find(s => s.name === 'MOTION_REF')
    expect(ref?.warning).toBeDefined()
  })

  it('counts scoop tips past the dip line and back', () => {
    const tc = createTipCount()
    for (const y of [0, -10, -26, -30, -20, -9, -7, -30]) feedTip(tc, y)
    expect(tc.tips).toBe(1)
    expect(tc.dipped).toBe(true)
  })

  it('writes readings a builder can act on', () => {
    const takes = session()
    const suggestions = suggest(takes)
    const text = readingsText(
      takes,
      suggestions,
      checks(takes, CURRENT_PHONE, suggestedNumbers(suggestions)),
      'Spike'
    )
    expect(text).toContain('MOTION_REF 4 ->')
    expect(text).toContain('walk: ')
    // The current guesses fail some checks; the suggestions fail none.
    expect(text).toMatch(/ FAIL \|/)
    expect(text).not.toMatch(/FAIL$/m)
  })

  it('interpolates percentiles', () => {
    expect(percentile([3, 1, 2, 4], 0.5)).toBe(2.5)
    expect(percentile([], 0.9)).toBe(0)
  })
})

describe('tune overrides', () => {
  it('reads known phone numbers and skips the rest', () => {
    expect(
      parseTune(
        '?debug&tune=MOTION_REF:5.5,BOGUS:1,STOMP_SCALE:-1,REAL_STRIDE_M:x'
      )
    ).toEqual({ MOTION_REF: 5.5 })
    expect(parseTune('?tune=')).toEqual({})
    const value = tuneValue({ STEP_END_JOLT: 0.35, MOTION_REF: 6 })
    expect(value).toBe('MOTION_REF:6,STEP_END_JOLT:0.35')
    expect(parseTune(`?tune=${encodeURIComponent(value)}`)).toEqual({
      MOTION_REF: 6,
      STEP_END_JOLT: 0.35
    })
  })
})
