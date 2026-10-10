import { damp } from '../shared'
import {
  BODY_ASSIST_SCALE,
  BODY_FALL,
  BODY_RISE,
  CARRY_WALK,
  GAIT_SCALE
} from './tuning'
import type { LossCause } from './types'

/** The steady jolt of walking at `speed` m/s while carrying. */
export function gait(speed: number): number {
  const t = speed / CARRY_WALK.top
  return GAIT_SCALE * t * t
}

/** Bump pulse amplitude at `speed` m/s. */
export function bumpAmplitude(speed: number): number {
  return 0.2 + 0.08 * speed
}

/** A short burst added to the body level, such as a bump or a sneeze. */
export interface Pulse {
  amplitude: number
  msLeft: number
  cause: LossCause
}

const MAX_PULSES = 8

/**
 * The body level: footsteps, bumps and events, in game units. It rises and falls like the
 * hand meter but never reads Sensitivity, and Assist Mode scales it by its own factor, so
 * settings can't remove rushing or events. Pulses live in a fixed pool.
 */
export class BodyLevel {
  level = 0
  readonly pulses: Pulse[] = []

  /** Adds a pulse. When the pool is full, the weakest pulse is replaced. */
  pulse(amplitude: number, ms: number, cause: LossCause): void {
    if (this.pulses.length < MAX_PULSES) {
      this.pulses.push({ amplitude, msLeft: ms, cause })
      return
    }
    let weakest = this.pulses[0]
    for (const p of this.pulses)
      if (weakest && p.amplitude < weakest.amplitude) weakest = p
    if (weakest && weakest.amplitude < amplitude) {
      weakest.amplitude = amplitude
      weakest.msLeft = ms
      weakest.cause = cause
    }
  }

  /** Sum of active pulses. */
  pulseSum(): number {
    let sum = 0
    for (const p of this.pulses) sum += p.amplitude
    return sum
  }

  /** Cause of the largest active pulse, or null when none is active. */
  largestCause(): LossCause | null {
    let best: Pulse | null = null
    for (const p of this.pulses)
      if (!best || p.amplitude > best.amplitude) best = p
    return best ? best.cause : null
  }

  /** Advances one step with the current gait reading. */
  step(gaitRaw: number, dtMs: number, assist: boolean): void {
    const target =
      (gaitRaw + this.pulseSum()) * (assist ? BODY_ASSIST_SCALE : 1)
    const rate = target > this.level ? BODY_RISE : BODY_FALL
    this.level = damp(this.level, target, rate, dtMs / 1000)
    // Expire pulses after they have counted for this step.
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]
      if (!p) continue
      p.msLeft -= dtMs
      if (p.msLeft <= 0) this.pulses.splice(i, 1)
    }
  }

  reset(): void {
    this.level = 0
    this.pulses.length = 0
  }
}

/**
 * The level a bump would reach at `speed` with today's hand, for the ghost tick on the
 * ring. At or above 1, hitting it at this speed drains the sieve. `gaitScale` covers dry
 * slippers and paving underfoot, `weight` the Bigger Sieve. Paved segments have no bumps.
 */
export function predictedBumpLevel(
  hand: number,
  speed: number,
  assist: boolean,
  { weight = 1, gaitScale = 1 }: { weight?: number; gaitScale?: number } = {}
): number {
  const raw = gait(speed) * gaitScale + bumpAmplitude(speed)
  return (hand + raw * (assist ? BODY_ASSIST_SCALE : 1)) * weight
}

/** Total steadiness level from the hand and body levels. */
export function totalLevel(hand: number, body: number, weight = 1): number {
  return (hand + body) * weight
}
