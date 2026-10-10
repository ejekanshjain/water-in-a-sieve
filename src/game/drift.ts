import { damp } from '../shared'
import {
  DRIFT_AMP_RATE,
  DRIFT_BASE,
  DRIFT_FREQ_A,
  DRIFT_FREQ_B,
  DRIFT_PER_SPEED,
  FATIGUE_MAX,
  FATIGUE_PER_S,
  FATIGUE_START_S
} from './tuning'

/** Drift state: time, seeded phases per axis, and the current offset. */
export interface Drift {
  /** Drift clock in seconds; it only runs while you carry. */
  t: number
  p1: number
  p2: number
  p3: number
  p4: number
  /** Current drift in logical units. */
  x: number
  y: number
  /** Smoothed amplitude, so a sudden change of speed never makes the sieve jump. */
  amp: number
  /** Arm fatigue multiplier, 1 to FATIGUE_MAX. */
  fatigue: number
}

/** Fresh drift with phases picked from `random`. */
export function createDrift(random: () => number): Drift {
  const tau = Math.PI * 2
  return {
    t: 0,
    p1: random() * tau,
    p2: random() * tau,
    p3: random() * tau,
    p4: random() * tau,
    x: 0,
    y: 0,
    amp: 0,
    fatigue: 1
  }
}

/** Arm fatigue multiplier after `carrySeconds` of carrying water. */
export function fatigueFor(carrySeconds: number): number {
  return Math.min(
    FATIGUE_MAX,
    1 + FATIGUE_PER_S * Math.max(0, carrySeconds - FATIGUE_START_S)
  )
}

/** Drift amplitude in units at `speed` m/s. */
export function driftAmplitude(speed: number, fatigue: number): number {
  return (DRIFT_BASE + DRIFT_PER_SPEED * speed) * fatigue
}

/**
 * Advances drift by `dtMs` at `speed`. `scale` turns it off (0) for trip 1.
 * Writes the new offset into `drift.x` and `drift.y`.
 */
export function stepDrift(
  drift: Drift,
  dtMs: number,
  speed: number,
  carrySeconds: number,
  scale: number
): void {
  drift.t += dtMs / 1000
  drift.fatigue = fatigueFor(carrySeconds)
  const target = driftAmplitude(speed, drift.fatigue) * scale
  drift.amp = damp(drift.amp, target, DRIFT_AMP_RATE, dtMs / 1000)
  const amp = drift.amp
  const a = Math.PI * 2 * DRIFT_FREQ_A * drift.t
  const b = Math.PI * 2 * DRIFT_FREQ_B * drift.t
  drift.x = (amp * (Math.sin(a + drift.p1) + Math.sin(b + drift.p2))) / 2
  drift.y = (amp * (Math.sin(a + drift.p3) + Math.sin(b + drift.p4))) / 2
}
