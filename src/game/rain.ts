import type { ContainerLedger } from './containers'
import { RAIN_DRAIN_ML_PER_S, RAIN_ML_PER_S, RAIN_MS } from './tuning'

/** Each spring rain is a bigger joke than the last. */
export type RainGag = 'plain' | 'umbrella' | 'scoop' | 'rainbow'

/** Spring rain through the bathroom skylight: into the tub, then straight back out. */
export interface RainState {
  /** Dry, falling through the skylight, or draining back out. */
  stage: 'dry' | 'falling' | 'draining'
  /** Time into the current stage, in ms. */
  ms: number
  /** Rains so far, which picks the gag. */
  count: number
  gag: RainGag
  /** Fractions of a mL carried between steps. */
  rem: number
}

export function createRain(): RainState {
  return { stage: 'dry', ms: 0, count: 0, gag: 'plain', rem: 0 }
}

const GAGS: readonly RainGag[] = ['plain', 'umbrella', 'scoop', 'rainbow']

/** The gag for rain number `count` (1-based): it escalates, then stays a rainbow. */
export function rainGag(count: number): RainGag {
  return GAGS[Math.min(GAGS.length, Math.max(1, count)) - 1] ?? 'rainbow'
}

/** Starts the next rain. */
export function startRain(rain: RainState): void {
  rain.count++
  rain.gag = rainGag(rain.count)
  rain.stage = 'falling'
  rain.ms = 0
  rain.rem = 0
}

/**
 * One step of rain over the tub. It fills `rainMl` for RAIN_MS (not under the umbrella),
 * then drains it at a faster rate. Rain sits outside the tub's invariant and always
 * returns to 0. Returns `stopped` when the rain stops and `gone` once it's all drained.
 */
export function stepRain(
  rain: RainState,
  tub: ContainerLedger,
  dtMs: number
): 'none' | 'stopped' | 'gone' {
  if (rain.stage === 'dry') return 'none'
  // Only the part of this step before the rain stops adds water.
  const wetMs = Math.max(0, Math.min(dtMs, RAIN_MS - rain.ms))
  rain.ms += dtMs
  const dt = dtMs / 1000
  if (rain.stage === 'falling') {
    if (rain.gag !== 'umbrella' && !tub.done) {
      rain.rem += (RAIN_ML_PER_S * wetMs) / 1000
      const whole = Math.floor(rain.rem)
      rain.rem -= whole
      tub.rainMl += whole
    }
    if (rain.ms < RAIN_MS) return 'none'
    rain.stage = 'draining'
    rain.ms = 0
    rain.rem = 0
    return 'stopped'
  }
  rain.rem += RAIN_DRAIN_ML_PER_S * dt
  const whole = Math.min(Math.floor(rain.rem), tub.rainMl)
  rain.rem -= whole
  tub.rainMl -= whole
  if (tub.rainMl > 0) return 'none'
  rain.stage = 'dry'
  rain.rem = 0
  return 'gone'
}
