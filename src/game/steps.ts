import {
  GENTLE_STEP_JOLT,
  REAL_MAX_OWED_M,
  REAL_RUN_HOLD_MS,
  REAL_SLOW_GAP_MS,
  REAL_STEP_PULSE,
  REAL_STOP_MS,
  REAL_STRIDE_M,
  STEP_END_JOLT,
  STEP_MAX_MS,
  STEP_METRES,
  STEP_MIN_GAP_MS,
  STEP_START_JOLT,
  STOMP_SCALE,
  type WalkMode
} from './tuning'
import type { Walker } from './walker'

/**
 * Walk for Real: an optional phone mode where the motion sensor counts your real steps
 * and each one moves you 2 m. Gentle steps stay green; a stomp drains the sieve.
 */
export interface RealWalk {
  /** You chose Walk for Real. It only works while the phone is the sieve. */
  on: boolean
  /** On, and the phone is the sieve this step. */
  active: boolean
  /** The jolt is above the step threshold: a step is landing. */
  inStep: boolean
  /** How long the step landing now has lasted (ms). */
  stepMs: number
  /** Highest jolt in the step landing now, in m/s². */
  peak: number
  /** Time since the last step landed (ms). */
  gapMs: number
  /** Metres your steps still owe the walker. */
  owedM: number
  /** Walking speed from your step rhythm, in m/s. */
  cadence: number
  /** Steps this walk, for the HUD. */
  steps: number
  /** On empty walks, the last step keeps you running for this long (ms). */
  runMs: number
}

export function createRealWalk(): RealWalk {
  return {
    on: false,
    active: false,
    inStep: false,
    stepMs: 0,
    peak: 0,
    gapMs: REAL_SLOW_GAP_MS,
    owedM: 0,
    cadence: 0,
    steps: 0,
    runMs: 0
  }
}

/**
 * Feeds one smoothed jolt reading in m/s². A step starts when the jolt rises past the
 * start threshold and lands when it falls back, or after STEP_MAX_MS. Returns the step's
 * peak on the update it lands, otherwise 0. The spike recorder passes other thresholds.
 */
export function detectStep(
  rw: RealWalk,
  jolt: number,
  dtMs: number,
  start = STEP_START_JOLT,
  end = STEP_END_JOLT
): number {
  rw.gapMs += dtMs
  rw.runMs = Math.max(0, rw.runMs - dtMs)
  if (!rw.inStep) {
    if (jolt < start || rw.gapMs < STEP_MIN_GAP_MS) return 0
    rw.inStep = true
    rw.stepMs = 0
    rw.peak = jolt
    return 0
  }
  rw.stepMs += dtMs
  rw.peak = Math.max(rw.peak, jolt)
  if (jolt > end && rw.stepMs < STEP_MAX_MS) return 0
  rw.inStep = false
  landStep(rw)
  return rw.peak
}

/**
 * A step landed: it owes the walker one stride, at the speed of your rhythm. A first
 * step from standing counts as a slow one.
 */
function landStep(rw: RealWalk): void {
  const gapS = Math.min(rw.gapMs, REAL_SLOW_GAP_MS) / 1000
  rw.cadence = REAL_STRIDE_M / gapS
  rw.owedM = Math.min(REAL_MAX_OWED_M, rw.owedM + REAL_STRIDE_M)
  rw.gapMs = 0
  rw.steps++
  rw.runMs = REAL_RUN_HOLD_MS
}

/**
 * Forgets steps owed and the rhythm, for a new walk, and starts counting again. A step
 * that just left the house keeps running you home.
 */
export function resetRealWalk(rw: RealWalk): void {
  rw.owedM = 0
  rw.cadence = 0
  rw.steps = 0
  rw.gapMs = Math.max(rw.gapMs, REAL_SLOW_GAP_MS)
}

/**
 * Moves the walker by the strides your steps owe, at your rhythm's speed (capped by the
 * walk mode). Stop stepping for REAL_STOP_MS and you stand still.
 */
export function stepRealWalker(
  walker: Walker,
  rw: RealWalk,
  mode: WalkMode,
  dtMs: number
): void {
  if (rw.gapMs >= REAL_STOP_MS) rw.owedM = 0
  if (rw.owedM <= 0) {
    walker.speed = 0
    return
  }
  walker.speed = Math.min(mode.top, rw.cadence)
  const moved = Math.min(rw.owedM, (walker.speed * dtMs) / 1000)
  rw.owedM -= moved
  walker.distance += moved * walker.dir
  // Strides add up in floating point: snap, so two 2 m steps land on exactly 4 m.
  if (rw.owedM <= 0) walker.distance = Math.round(walker.distance * 1e6) / 1e6
  // The legs still swing every STEP_METRES, so the hero walks the way the path scrolls.
  walker.stride += moved
  while (walker.stride >= STEP_METRES) {
    walker.stride -= STEP_METRES
    walker.steps++
  }
}

/**
 * The body pulse a real step adds: a small one for the rhythm, and a stomp pulse that
 * grows with the square of how far the peak passes a gentle step. 3 m/s² reaches 1.
 */
export function stepPulse(
  peak: number,
  gentle = GENTLE_STEP_JOLT,
  stompScale = STOMP_SCALE
): number {
  const over = Math.max(0, peak - gentle)
  return REAL_STEP_PULSE + stompScale * over * over
}
