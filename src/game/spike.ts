import { damp } from '../shared'
import { BodyLevel } from './steadiness'
import { createRealWalk, detectStep, stepPulse } from './steps'
import type { PhoneNumber, PhoneNumbers } from './tune'
import {
  BREAK_LEVEL,
  CALIBRATE_STILL_JOLT,
  GENTLE_STEP_JOLT,
  HAND_FALL,
  HAND_RISE,
  MOTION_DIP_DEGREES,
  MOTION_LIFT_DEGREES,
  MOTION_REF,
  PATH_METRES,
  REAL_HAND_SCALE,
  REAL_STEP_PULSE,
  REAL_STEP_PULSE_MS,
  REAL_STRIDE_M,
  SLOSH_LEVEL,
  STEP_END_JOLT,
  STEP_START_JOLT,
  STOMP_SCALE,
  TOUCH_GRACE_MS,
  TOUCH_GRACE_SCALE
} from './tuning'

/**
 * The real-phone spike (dev only, `?spike`): takes of a phone held like a tray, and the
 * phone numbers they suggest. Each target below is an acceptance line of the real-phone
 * follow-up in PLAN.md.
 */

/** A still hold reads under this. */
export const STILL_LEVEL = 0.1
/** A thumb press or release barely moves the ring. */
export const PRESS_LEVEL = 0.15
/** A careful scoop tip stays well inside the green. */
export const SCOOP_LEVEL = 0.5
/** While you walk for real, the hand reads about this at most, so steps stay green. */
export const WALK_HAND_LEVEL = 0.3
/** Without knocks, the hand limit sits this far above the least the still hold needs. */
const REF_MARGIN = 1.5
/** Readings this soon after a take starts are skipped while you settle (ms). */
const SETTLE_MS = 250
const STILL_SETTLE_MS = 1000
/** Tapping Done shakes the phone, so this much is cut off the end (ms). */
export const DONE_TAIL_MS = 600

export type SpikeStageId =
  | 'still'
  | 'presses'
  | 'scoops'
  | 'knocks'
  | 'slow'
  | 'tiptoe'
  | 'walk'
  | 'stomps'

export interface SpikeStage {
  id: SpikeStageId
  title: string
  /** What to do, in short sentences. */
  how: string
  /**
   * How the take ends: after `seconds`, a second after `count` thumb presses or scoop
   * tips, or when you tap Done.
   */
  ends: 'timer' | 'presses' | 'tips' | 'done'
  seconds?: number
  /** How many presses, tips, knocks, steps or stomps the take asks for. */
  count: number
}

export const SPIKE_STAGES: readonly SpikeStage[] = [
  {
    id: 'still',
    title: 'Still Hold',
    how: 'Hold the phone flat in front of you, screen up, like a tray. Keep still until the beep.',
    ends: 'timer',
    seconds: 8,
    count: 0
  },
  {
    id: 'presses',
    title: 'Thumb Presses',
    how: 'Hold it like a tray. Press the pad with your thumb for about a second, then lift. Do it 8 times.',
    ends: 'presses',
    count: 8
  },
  {
    id: 'scoops',
    title: 'Scoop Tips',
    how: 'Tip the top edge down until the screen says Dipped, then bring it back flat. Go as gently as you would in the game. Do it 5 times.',
    ends: 'tips',
    count: 5
  },
  {
    id: 'knocks',
    title: 'Sharp Knocks',
    how: 'Hold it like a tray. Give it 5 sharp knocks, like someone bumped your elbow. Stop at the beep.',
    ends: 'timer',
    seconds: 10,
    count: 5
  },
  {
    id: 'slow',
    title: 'Slow Walk',
    how: 'Hold it like a tray and take 20 slow, careful steps. Tap Done after the 20th.',
    ends: 'done',
    count: 20
  },
  {
    id: 'tiptoe',
    title: 'Tiptoe',
    how: 'Tiptoe 20 steps, as softly as you can. Tap Done after the 20th.',
    ends: 'done',
    count: 20
  },
  {
    id: 'walk',
    title: 'Walk for Real',
    how: 'Walk 50 steps the way you would carry a full sieve. Count them. Tap Done after the 50th.',
    ends: 'done',
    count: 50
  },
  {
    id: 'stomps',
    title: 'Stomps',
    how: 'Walk on and stomp hard on 5 of your steps. Tap Done after the fifth stomp.',
    ends: 'done',
    count: 5
  }
]

const WALK_STAGES: readonly SpikeStageId[] = ['slow', 'tiptoe', 'walk']

/** One phone reading as the game samples it. `t` is ms from the take's start. */
export interface SpikeSample {
  t: number
  /** The smoothed jolt the game feeds the hand meter, in m/s². */
  jolt: number
  tiltX: number
  tiltY: number
}

export interface SpikeTake {
  stage: SpikeStageId
  samples: SpikeSample[]
  /** Touch presses and releases, ms from the take's start. */
  touches: number[]
  /** The take ended on a Done tap, whose own shake is cut off. */
  tappedDone: boolean
}

export type SpikeTakes = Partial<Record<SpikeStageId, SpikeTake>>

/** The phone numbers the game runs on now. */
export const CURRENT_PHONE: PhoneNumbers = {
  MOTION_REF,
  TOUCH_GRACE_MS,
  TOUCH_GRACE_SCALE,
  STEP_START_JOLT,
  STEP_END_JOLT,
  REAL_STRIDE_M,
  REAL_HAND_SCALE,
  GENTLE_STEP_JOLT,
  STOMP_SCALE
}

// ---------------------------------------------------------------- Scoop tips

/** Counts scoop tips the way the game dips: past MOTION_DIP_DEGREES, back over the lift line. */
export interface TipCount {
  dipped: boolean
  tips: number
}

export function createTipCount(): TipCount {
  return { dipped: false, tips: 0 }
}

/** Feeds one forward tilt reading. Returns true when a tip comes back up. */
export function feedTip(tc: TipCount, tiltY: number): boolean {
  if (tiltY <= -MOTION_DIP_DEGREES) tc.dipped = true
  else if (tc.dipped && tiltY >= -MOTION_LIFT_DEGREES) {
    tc.dipped = false
    tc.tips++
    return true
  }
  return false
}

// ---------------------------------------------------------------- Signal helpers

/** The `p` quantile (0 to 1) of `values`, interpolated. 0 for no values. */
export function percentile(values: ArrayLike<number>, p: number): number {
  if (values.length === 0) return 0
  const sorted = Array.from(values).sort((a, b) => a - b)
  const at = (sorted.length - 1) * Math.min(1, Math.max(0, p))
  const lo = sorted[Math.floor(at)] ?? 0
  const hi = sorted[Math.ceil(at)] ?? lo
  return lo + (hi - lo) * (at - Math.floor(at))
}

function maxOf(values: ArrayLike<number>): number {
  let best = 0
  for (let i = 0; i < values.length; i++) best = Math.max(best, values[i] ?? 0)
  return best
}

/** The first and past-the-last sample indices that count, after settling and the Done tap. */
function windowOf(take: SpikeTake): [number, number] {
  const samples = take.samples
  const last = samples[samples.length - 1]?.t ?? 0
  const from = take.stage === 'still' ? STILL_SETTLE_MS : SETTLE_MS
  const to = last - (take.tappedDone ? DONE_TAIL_MS : 0)
  let i0 = 0
  while (i0 < samples.length && (samples[i0]?.t ?? 0) < from) i0++
  let i1 = samples.length
  while (i1 > i0 && (samples[i1 - 1]?.t ?? 0) > to) i1--
  return [i0, i1]
}

const gapCache = new WeakMap<SpikeTake, Float64Array>()

/** Time between readings in ms, for a whole take. The first counts as one 60 Hz frame. */
function gaps(take: SpikeTake): Float64Array {
  const cached = gapCache.get(take)
  if (cached?.length === take.samples.length) return cached
  const out = new Float64Array(take.samples.length)
  let prev = (take.samples[0]?.t ?? 0) - 1000 / 60
  take.samples.forEach((s, i) => {
    out[i] = Math.min(100, Math.max(0, s.t - prev))
    prev = s.t
  })
  gapCache.set(take, out)
  return out
}

/**
 * The hand meter over a take: each reading's jolt times `gain(i)`, divided by `ref`,
 * rising and falling at the game's rates. Sensitivity 1, Assist Mode off.
 */
function handTrace(
  take: SpikeTake,
  ref: number,
  gain: (i: number) => number = () => 1
): Float64Array {
  const dt = gaps(take)
  const out = new Float64Array(take.samples.length)
  let level = 0
  take.samples.forEach((s, i) => {
    const target = (s.jolt * gain(i)) / ref
    const rate = target > level ? HAND_RISE : HAND_FALL
    level = damp(level, target, rate, (dt[i] ?? 0) / 1000)
    out[i] = level
  })
  return out
}

/** Ms since the latest touch press or release at each reading, or Infinity before any. */
function sinceTouch(take: SpikeTake): Float64Array {
  const out = new Float64Array(take.samples.length)
  const touches = [...take.touches].sort((a, b) => a - b)
  let next = 0
  let latest = -Infinity
  take.samples.forEach((s, i) => {
    while (next < touches.length && (touches[next] ?? Infinity) <= s.t)
      latest = touches[next++] ?? latest
    out[i] = s.t - latest
  })
  return out
}

/** The `count` highest local peaks between `i0` and `i1`, at least `gapMs` apart, highest first. */
function topPeaks(
  values: ArrayLike<number>,
  take: SpikeTake,
  [i0, i1]: [number, number],
  count: number,
  gapMs: number
): number[] {
  const tops: number[] = []
  for (let i = i0; i < i1; i++) {
    const v = values[i] ?? 0
    if (v >= (values[i - 1] ?? -Infinity) && v > (values[i + 1] ?? -Infinity))
      tops.push(i)
  }
  tops.sort((a, b) => (values[b] ?? 0) - (values[a] ?? 0))
  const picked: number[] = []
  for (const i of tops) {
    if (picked.length >= count) break
    const t = take.samples[i]?.t ?? 0
    if (picked.every(j => Math.abs((take.samples[j]?.t ?? 0) - t) >= gapMs))
      picked.push(i)
  }
  return picked.map(i => values[i] ?? 0)
}

function slice(values: Float64Array, [i0, i1]: [number, number]) {
  return values.subarray(i0, i1)
}

/** Steps counted in a take's window and their peaks, as Walk for Real would count them. */
function countSteps(
  take: SpikeTake,
  start: number,
  end: number,
  gain: (i: number) => number = () => 1
): number[] {
  const rw = createRealWalk()
  const dt = gaps(take)
  const [i0, i1] = windowOf(take)
  const peaks: number[] = []
  take.samples.forEach((s, i) => {
    const peak = detectStep(rw, s.jolt * gain(i), dt[i] ?? 0, start, end)
    if (peak > 0 && i >= i0 && i < i1) peaks.push(peak)
  })
  return peaks
}

/**
 * Steps counted while standing still or pressing a thumb (with touch grace), or null
 * before either take.
 */
function standingSteps(
  takes: SpikeTakes,
  start: number,
  end: number,
  pressGain?: (i: number) => number
): number | null {
  const { still, presses } = takes
  if (!still && !presses) return null
  return (
    (still ? countSteps(still, start, end).length : 0) +
    (presses ? countSteps(presses, start, end, pressGain).length : 0)
  )
}

/**
 * Walking for real: the hand at the walking scale plus each step's body pulse, as the
 * game totals them for the plain sieve.
 */
function walkTotals(take: SpikeTake, n: PhoneNumbers): Float64Array {
  const rw = createRealWalk()
  const body = new BodyLevel()
  const hand = handTrace(take, n.MOTION_REF, () => n.REAL_HAND_SCALE)
  const dt = gaps(take)
  const out = new Float64Array(take.samples.length)
  take.samples.forEach((s, i) => {
    const step = dt[i] ?? 0
    const peak = detectStep(
      rw,
      s.jolt,
      step,
      n.STEP_START_JOLT,
      n.STEP_END_JOLT
    )
    if (peak > 0)
      body.pulse(
        stepPulse(peak, n.GENTLE_STEP_JOLT, n.STOMP_SCALE),
        REAL_STEP_PULSE_MS,
        'stomp'
      )
    body.step(0, step, false)
    out[i] = (hand[i] ?? 0) + body.level
  })
  return out
}

/** Touch grace's gain at each reading of a take with presses. */
function graceGain(
  since: Float64Array,
  ms: number,
  scale: number
): (i: number) => number {
  return i => ((since[i] ?? Infinity) < ms ? scale : 1)
}

// ---------------------------------------------------------------- Measuring

/** What a set of phone numbers makes of the takes. Null where a take is missing. */
export interface SpikeReadings {
  /** The still hold's hand level, 95th percentile. */
  still: number | null
  /** The highest hand level during thumb presses, with touch grace. */
  presses: number | null
  /** The highest hand level during scoop tips. */
  scoops: number | null
  /** The hand level each of the 5 biggest knocks reaches, highest first. */
  knocks: number[] | null
  /** Steps counted per walking take, against the steps asked for. */
  steps: { stage: SpikeStageId; counted: number; asked: number }[]
  /** Steps counted while standing still or pressing a thumb. */
  standingSteps: number | null
  /** The careful 50-step walk's total level, 95th percentile. */
  walk: number | null
  /** The total each of the 5 biggest stomps reaches, highest first. */
  stomps: number[] | null
}

/** Reads every take through a set of phone numbers, the way the game would. */
export function measure(takes: SpikeTakes, n: PhoneNumbers): SpikeReadings {
  const ref = n.MOTION_REF
  const { still, presses, scoops, knocks, walk, stomps } = takes
  const pressGain = presses
    ? graceGain(sinceTouch(presses), n.TOUCH_GRACE_MS, n.TOUCH_GRACE_SCALE)
    : undefined
  const steps = WALK_STAGES.flatMap(stage => {
    const take = takes[stage]
    if (!take) return []
    const counted = countSteps(take, n.STEP_START_JOLT, n.STEP_END_JOLT).length
    return [{ stage, counted, asked: askedFor(stage) }]
  })
  const standing = standingSteps(
    takes,
    n.STEP_START_JOLT,
    n.STEP_END_JOLT,
    pressGain
  )
  return {
    still: still
      ? percentile(slice(handTrace(still, ref), windowOf(still)), 0.95)
      : null,
    presses: presses
      ? maxOf(slice(handTrace(presses, ref, pressGain), windowOf(presses)))
      : null,
    scoops: scoops
      ? maxOf(slice(handTrace(scoops, ref), windowOf(scoops)))
      : null,
    knocks: knocks
      ? topPeaks(handTrace(knocks, ref), knocks, windowOf(knocks), 5, 400)
      : null,
    steps,
    standingSteps: standing,
    walk: walk
      ? percentile(slice(walkTotals(walk, n), windowOf(walk)), 0.95)
      : null,
    stomps: stomps
      ? topPeaks(walkTotals(stomps, n), stomps, windowOf(stomps), 5, 300)
      : null
  }
}

function askedFor(stage: SpikeStageId): number {
  return SPIKE_STAGES.find(s => s.id === stage)?.count ?? 0
}

// ---------------------------------------------------------------- Suggesting

export interface Suggestion {
  name: PhoneNumber
  now: number
  value: number
  /** Why, in a sentence or two. */
  why: string
  /** The readings can't meet every target with this number. */
  warning?: string
}

const round = (value: number, step: number) =>
  Math.round(Math.round(value / step) * step * 1000) / 1000
const fmt = (value: number) => String(round(value, 0.01))

/**
 * Suggests every phone number from the takes recorded so far. Numbers whose takes are
 * missing keep their current value and say which take they need.
 */
export function suggest(
  takes: SpikeTakes,
  now: PhoneNumbers = CURRENT_PHONE
): Suggestion[] {
  const out: Suggestion[] = []
  const keep = (name: PhoneNumber, needs: string): number => {
    out.push({ name, now: now[name], value: now[name], why: `Needs ${needs}.` })
    return now[name]
  }
  const add = (s: Omit<Suggestion, 'now'>): number => {
    out.push({ ...s, now: now[s.name] })
    return s.value
  }

  const ref = takes.still
    ? add(suggestRef(takes))
    : keep('MOTION_REF', 'the Still Hold')

  let graceMs = now.TOUCH_GRACE_MS
  let graceScale = now.TOUCH_GRACE_SCALE
  if (takes.presses) {
    const grace = suggestGrace(takes.presses, ref)
    graceMs = add(grace.ms)
    graceScale = add(grace.scale)
  } else {
    keep('TOUCH_GRACE_MS', 'Thumb Presses')
    keep('TOUCH_GRACE_SCALE', 'Thumb Presses')
  }

  const walking = WALK_STAGES.some(stage => takes[stage])
  if (!walking) {
    for (const name of [
      'STEP_START_JOLT',
      'STEP_END_JOLT',
      'REAL_STRIDE_M',
      'REAL_HAND_SCALE',
      'GENTLE_STEP_JOLT',
      'STOMP_SCALE'
    ] as const)
      keep(name, 'a walking take')
    return out
  }

  const { start, end } = suggestSteps(takes, graceMs, graceScale, out, now)
  if (takes.walk) {
    const counted = countSteps(takes.walk, start, end).length
    const value = round(
      Math.min(4, Math.max(1, PATH_METRES / Math.max(1, counted))),
      0.1
    )
    add({
      name: 'REAL_STRIDE_M',
      value,
      why: `${counted} steps counted for ${askedFor('walk')} taken, so ${value} m a step walks the ${PATH_METRES} m path in ${askedFor('walk')}.`
    })
  } else keep('REAL_STRIDE_M', 'Walk for Real')

  const walkTakes = WALK_STAGES.flatMap(stage => takes[stage] ?? [])
  // At a limit of 1 the hand meter reads in m/s², so this is the walk's shake.
  const levels = walkTakes.flatMap(take =>
    Array.from(slice(handTrace(take, 1), windowOf(take)))
  )
  const shake = percentile(levels, 0.9)
  const handScale = round(
    Math.min(1, Math.max(0.1, (WALK_HAND_LEVEL * ref) / Math.max(shake, 0.01))),
    0.05
  )
  add({
    name: 'REAL_HAND_SCALE',
    value: handScale,
    why: `Walking shakes the phone to ${fmt(shake)} m/s² at most, 9 times in 10. At ${handScale} the hand reads ${fmt((shake * handScale) / ref)} then.`
  })

  const gentlePeaks = walkTakes.flatMap(take => countSteps(take, start, end))
  const gentle = round(Math.max(start, percentile(gentlePeaks, 0.9)), 0.1)
  add({
    name: 'GENTLE_STEP_JOLT',
    value: gentle,
    why: `9 of 10 careful steps peak under ${gentle} m/s², so they add no stomp pulse.`
  })

  if (takes.stomps) {
    const peaks = countSteps(takes.stomps, start, end)
      .sort((a, b) => b - a)
      .slice(0, 5)
    const stomp = peaks[3] ?? peaks[peaks.length - 1] ?? gentle
    const over = stomp - gentle
    const scale = (BREAK_LEVEL - REAL_STEP_PULSE) / Math.max(0.3, over) ** 2
    add({
      name: 'STOMP_SCALE',
      value: Number(scale.toPrecision(2)),
      why: `4 of 5 stomps peak at ${fmt(stomp)} m/s² or more, so they drain on their own.`,
      ...(over < 0.3 && {
        warning:
          'Stomps barely beat careful steps. Stomp harder or walk softer.'
      })
    })
  } else keep('STOMP_SCALE', 'Stomps')
  return out
}

/** The hand limit: a still hold under 0.1, careful scoops in the green, knocks draining. */
function suggestRef(takes: SpikeTakes): Omit<Suggestion, 'now'> {
  const { still, scoops, knocks } = takes
  const stillJolt = still
    ? percentile(slice(handTrace(still, 1), windowOf(still)), 0.95)
    : 0
  const scoopJolt = scoops
    ? maxOf(slice(handTrace(scoops, 1), windowOf(scoops)))
    : 0
  const lower = Math.max(stillJolt / STILL_LEVEL, scoopJolt / SCOOP_LEVEL, 0.5)
  const peaks = knocks
    ? topPeaks(handTrace(knocks, 1), knocks, windowOf(knocks), 5, 400)
    : []
  const upper = peaks[3] ?? peaks[peaks.length - 1]
  // Halfway between the two on a log scale: stillness and knocks get the same margin.
  const value = round(
    upper === undefined ? lower * REF_MARGIN : Math.sqrt(lower * upper),
    0.1
  )
  const parts = [`a still hold reads ${fmt(stillJolt)} m/s²`]
  if (scoops) parts.push(`careful scoops ${fmt(scoopJolt)}`)
  if (upper !== undefined) parts.push(`4 of 5 knocks ${fmt(upper)} or more`)
  return {
    name: 'MOTION_REF',
    value,
    why: `On this phone ${parts.join(', ')}.`,
    ...(upper !== undefined &&
      lower > upper && {
        warning:
          'Knocks read softer than careful moves, so no limit splits them. Knock harder.'
      })
  }
}

/**
 * Touch grace: the gentlest window and scale that keep thumb presses under 0.15. The cost
 * of a choice is how much real shake it hides, its length times what it takes away.
 */
function suggestGrace(
  presses: SpikeTake,
  ref: number
): { ms: Omit<Suggestion, 'now'>; scale: Omit<Suggestion, 'now'> } {
  const since = sinceTouch(presses)
  const window = windowOf(presses)
  let best = { ms: 0, scale: 1, level: Infinity, cost: Infinity, ok: false }
  for (let ms = 0; ms <= 500; ms += 25) {
    for (let k = 20; k >= 2; k--) {
      const scale = k / 20
      const level = maxOf(
        slice(handTrace(presses, ref, graceGain(since, ms, scale)), window)
      )
      const ok = level <= PRESS_LEVEL
      const cost = ms * (1 - scale)
      const better = ok
        ? !best.ok || cost < best.cost
        : !best.ok && level < best.level
      if (better) best = { ms, scale, level, cost, ok }
    }
  }
  const off = best.cost === 0
  const why = off
    ? `Thumb presses stay at ${fmt(best.level)} without grace on this phone.`
    : `With ${best.ms} ms at ${best.scale}, thumb presses read ${fmt(best.level)} at most.`
  const scaleWhy = off
    ? 'Grace is off, so jolts always count in full.'
    : `Jolts count at ${best.scale} for ${best.ms} ms after each press or release.`
  const warning = best.ok
    ? undefined
    : 'No grace keeps presses under 0.15. Press more gently, or accept a twitchy ring.'
  return {
    ms: {
      name: 'TOUCH_GRACE_MS',
      value: off ? 0 : best.ms,
      why,
      ...(warning && { warning })
    },
    scale: {
      name: 'TOUCH_GRACE_SCALE',
      value: off ? 1 : best.scale,
      why: scaleWhy
    }
  }
}

/**
 * Step thresholds: the start and end that count the asked-for steps in every walking take,
 * catch each footfall's peak and count none while standing. Among equally good starts it
 * takes the middle of the widest run, so a slightly harder or softer walker still counts.
 */
function suggestSteps(
  takes: SpikeTakes,
  graceMs: number,
  graceScale: number,
  out: Suggestion[],
  now: PhoneNumbers
): { start: number; end: number } {
  const pressGain = takes.presses
    ? graceGain(sinceTouch(takes.presses), graceMs, graceScale)
    : undefined
  const ratios = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  const starts: number[] = []
  for (let s = 0.2; s <= 3.0001; s += 0.05) starts.push(round(s, 0.01))
  // The footfalls themselves: the biggest jolt peaks, one per step asked for.
  const footfalls = new Map<SpikeStageId, number>()
  for (const stage of [...WALK_STAGES, 'stomps'] as const) {
    const take = takes[stage]
    if (!take) continue
    const jolts = take.samples.map(sample => sample.jolt)
    const peaks = topPeaks(jolts, take, windowOf(take), askedFor(stage), 250)
    footfalls.set(stage, percentile(peaks, 0.5))
  }
  // How far the counted steps' peaks fall short of the footfalls: a step that starts
  // early on the walk's background shake can land before its own footfall.
  const shortfall = (stage: SpikeStageId, peaks: number[]) =>
    Math.max(0, 1 - percentile(peaks, 0.5) / (footfalls.get(stage) ?? 1))
  const errors = ratios.map(ratio =>
    starts.map(start => {
      // Rounded as suggested, so the counts below are the counts you get.
      const end = round(start * ratio, 0.05)
      if (end >= start) return Infinity
      let error = 0
      for (const stage of WALK_STAGES) {
        const take = takes[stage]
        if (!take) continue
        const asked = askedFor(stage)
        const peaks = countSteps(take, start, end)
        error += Math.abs(peaks.length - asked) / asked
        error += shortfall(stage, peaks)
      }
      if (takes.stomps) {
        const peaks = countSteps(takes.stomps, start, end)
        error += shortfall('stomps', peaks.sort((a, b) => b - a).slice(0, 5))
      }
      return error + (standingSteps(takes, start, end, pressGain) ?? 0) * 0.2
    })
  )
  const least = Math.min(...errors.flat())
  // The end ratio closest to half that counts as well as any: the game's 0.8 and 0.4.
  const good = (e: number | undefined) => (e ?? Infinity) <= least + 0.01
  let r = 0
  ratios.forEach((ratio, i) => {
    const counts = (errors[i] ?? []).some(good)
    const better = Math.abs(ratio - 0.5) < Math.abs((ratios[r] ?? 0) - 0.5)
    if (counts && (!(errors[r] ?? []).some(good) || better)) r = i
  })
  // Then the middle of its widest run of good starts.
  const row = errors[r] ?? []
  let pick = { start: now.STEP_START_JOLT, run: 0 }
  let runStart = -1
  for (let i = 0; i <= row.length; i++) {
    const inRun = i < row.length && good(row[i])
    if (inRun && runStart < 0) runStart = i
    if (inRun || runStart < 0) continue
    if (i - runStart > pick.run)
      pick = {
        start: starts[Math.floor((runStart + i - 1) / 2)] ?? 0,
        run: i - runStart
      }
    runStart = -1
  }
  const ratio = ratios[r] ?? 0.5
  const start = round(pick.start, 0.05)
  const end = round(start * ratio, 0.05)
  const counts = WALK_STAGES.flatMap(stage => {
    const take = takes[stage]
    if (!take) return []
    return [`${countSteps(take, start, end).length} of ${askedFor(stage)}`]
  })
  const standing = standingSteps(takes, start, end, pressGain) ?? 0
  const why = `It counts ${counts.join(', ')} steps, and ${standing} while standing.`
  const warning =
    least > 0.1
      ? 'Some steps were missed, doubled or felt while standing. See the checks.'
      : undefined
  out.push({
    name: 'STEP_START_JOLT',
    now: now.STEP_START_JOLT,
    value: start,
    why,
    ...(warning && { warning })
  })
  out.push({
    name: 'STEP_END_JOLT',
    now: now.STEP_END_JOLT,
    value: end,
    why: `A step lands once the jolt falls under ${Math.round(ratio * 100)}% of its start.`
  })
  return { start, end }
}

/** The suggested values as a full set of phone numbers. */
export function suggestedNumbers(suggestions: Suggestion[]): PhoneNumbers {
  const out = { ...CURRENT_PHONE }
  for (const s of suggestions) out[s.name] = s.value
  return out
}

// ---------------------------------------------------------------- Checks

export interface SpikeCheck {
  label: string
  now: string
  next: string
  /** Null when the check can't run without a take. */
  nowOk: boolean | null
  nextOk: boolean | null
}

/** Each real-phone acceptance line, read with the current and the suggested numbers. */
export function checks(
  takes: SpikeTakes,
  now: PhoneNumbers,
  next: PhoneNumbers
): SpikeCheck[] {
  const a = measure(takes, now)
  const b = measure(takes, next)
  const rows: SpikeCheck[] = []
  const row = (
    label: string,
    pick: (r: SpikeReadings) => number | number[] | null,
    show: (v: number | number[]) => string,
    pass: (v: number | number[]) => boolean
  ) => {
    const x = pick(a)
    const y = pick(b)
    rows.push({
      label,
      now: x === null ? 'n/a' : show(x),
      next: y === null ? 'n/a' : show(y),
      nowOk: x === null ? null : pass(x),
      nextOk: y === null ? null : pass(y)
    })
  }
  const one = (v: number | number[]) => (typeof v === 'number' ? v : 0)
  const many = (v: number | number[]) => (typeof v === 'number' ? [v] : v)
  const draining = (v: number | number[]) =>
    many(v).filter(x => x >= BREAK_LEVEL).length

  const stillJolt = takes.still
    ? percentile(slice(handTrace(takes.still, 1), windowOf(takes.still)), 0.95)
    : null
  rows.push({
    label: 'Tray step can calibrate',
    now: stillJolt === null ? 'n/a' : `${fmt(stillJolt)} m/s²`,
    next: stillJolt === null ? 'n/a' : `${fmt(stillJolt)} m/s²`,
    nowOk: stillJolt === null ? null : stillJolt < CALIBRATE_STILL_JOLT,
    nextOk: stillJolt === null ? null : stillJolt < CALIBRATE_STILL_JOLT
  })
  row(
    `Still hold under ${STILL_LEVEL}`,
    r => r.still,
    v => fmt(one(v)),
    v => one(v) < STILL_LEVEL
  )
  row(
    `Thumb presses under ${PRESS_LEVEL}`,
    r => r.presses,
    v => fmt(one(v)),
    v => one(v) <= PRESS_LEVEL
  )
  row(
    'Careful scoops stay green',
    r => r.scoops,
    v => fmt(one(v)),
    v => one(v) < SLOSH_LEVEL
  )
  row(
    'Knocks that drain',
    r => r.knocks,
    v => `${draining(v)} of 5`,
    v => draining(v) >= 4
  )
  const stepRow = (r: SpikeReadings) =>
    r.steps.length === 0 ? null : r.steps.map(s => s.counted)
  const asked = a.steps.map(s => s.asked)
  row(
    'Steps counted',
    stepRow,
    v =>
      many(v)
        .map((c, i) => `${c}/${asked[i] ?? 0}`)
        .join(', '),
    v =>
      many(v).every((c, i) => {
        const want = asked[i] ?? 0
        return Math.abs(c - want) <= Math.max(1, want * 0.1)
      })
  )
  row(
    'Steps felt while standing',
    r => r.standingSteps,
    v => String(one(v)),
    v => one(v) === 0
  )
  row(
    'Careful walk stays green',
    r => r.walk,
    v => fmt(one(v)),
    v => one(v) < SLOSH_LEVEL
  )
  row(
    'Stomps that drain',
    r => r.stomps,
    v => `${draining(v)} of 5`,
    v => draining(v) >= 4
  )
  return rows
}

// ---------------------------------------------------------------- Readings text

/** One line per take: how long it ran and how hard the phone shook. */
export function takeLine(take: SpikeTake): string {
  const [i0, i1] = windowOf(take)
  const jolts = take.samples.slice(i0, i1).map(s => s.jolt)
  const seconds = (
    (take.samples[take.samples.length - 1]?.t ?? 0) / 1000
  ).toFixed(1)
  return `${seconds}s, ${take.samples.length} readings, jolt p50 ${fmt(percentile(jolts, 0.5))} p95 ${fmt(percentile(jolts, 0.95))} max ${fmt(maxOf(jolts))} m/s²`
}

/**
 * Everything a builder needs to set the numbers, as plain text for Copy Readings:
 * the suggestions, the checks and each take's numbers.
 */
export function readingsText(
  takes: SpikeTakes,
  suggestions: Suggestion[],
  rows: SpikeCheck[],
  header: string
): string {
  const lines = [header, '', 'Suggested (now -> suggested):']
  for (const s of suggestions) {
    lines.push(`${s.name} ${s.now} -> ${s.value}. ${s.why}`)
    if (s.warning) lines.push(`  Warning: ${s.warning}`)
  }
  lines.push('', 'Checks (now | suggested):')
  for (const r of rows)
    lines.push(
      `${r.label}: ${r.now} ${mark(r.nowOk)} | ${r.next} ${mark(r.nextOk)}`
    )
  lines.push('', 'Takes:')
  const next = suggestedNumbers(suggestions)
  for (const stage of SPIKE_STAGES) {
    const take = takes[stage.id]
    if (!take) {
      lines.push(`${stage.id}: not recorded`)
      continue
    }
    let extra = ''
    if (stage.id === 'presses') extra = `, ${take.touches.length} touches`
    if (WALK_STAGES.includes(stage.id) || stage.id === 'stomps') {
      const peaks = countSteps(take, next.STEP_START_JOLT, next.STEP_END_JOLT)
      extra = `, ${peaks.length} steps, peaks ${peaks.map(fmt).join(' ')}`
    }
    if (stage.id === 'knocks')
      extra = `, top jolts ${topPeaks(handTrace(take, 1), take, windowOf(take), 5, 400).map(fmt).join(' ')}`
    lines.push(`${stage.id}: ${takeLine(take)}${extra}`)
  }
  return lines.join('\n')
}

function mark(ok: boolean | null): string {
  return ok === null ? '' : ok ? 'ok' : 'FAIL'
}
