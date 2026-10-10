import {
  ASSIST_TILT_SCALE,
  BASE_CAPACITY_ML,
  BIG_SIEVE_WEIGHT,
  BASE_DRIP_PER_S,
  BREAK_LEVEL,
  DEGREES_PER_UNIT,
  DRIBBLE_DEGREES,
  DRIBBLE_PER_S,
  SLOSH_LEVEL,
  SLOSH_PER_S,
  TIP_DEGREES
} from './tuning'
import type { Zone } from './types'

/** Upgrades that change how the sieve holds water. */
export interface SieveGear {
  finerMesh: boolean
  biggerSieve: boolean
  wax: boolean
}

export const NO_GEAR: SieveGear = {
  finerMesh: false,
  biggerSieve: false,
  wax: false
}

/** Wax multiplies base drip, hole leaks and slosh by this. */
const WAX_SCALE = 0.35
/** Finer Mesh adds this much capacity and multiplies base drip by FINE_DRIP_SCALE. */
const FINE_EXTRA_ML = 500
const FINE_DRIP_SCALE = 0.7

/** Sieve capacity in mL: 1.0, 1.5, 2.0 or 3.0 L. */
export function capacityMl(gear: SieveGear): number {
  return (
    (BASE_CAPACITY_ML + (gear.finerMesh ? FINE_EXTRA_ML : 0)) *
    (gear.biggerSieve ? 2 : 1)
  )
}

/** How much heavier the sieve makes every wobble: BIG_SIEVE_WEIGHT for the Bigger Sieve. */
export function sieveWeight(gear: SieveGear): number {
  return gear.biggerSieve ? BIG_SIEVE_WEIGHT : 1
}

/** Base drip in mL per second for `waterMl` in the sieve. Doesn't count against No-Drip. */
export function baseDripRate(waterMl: number, gear: SieveGear): number {
  return (
    waterMl *
    BASE_DRIP_PER_S *
    (gear.finerMesh ? FINE_DRIP_SCALE : 1) *
    (gear.wax ? WAX_SCALE : 1)
  )
}

/** Slosh loss in mL per second at a total steadiness level. 0 in the green zone. */
export function sloshRate(
  waterMl: number,
  total: number,
  gear: SieveGear
): number {
  if (total <= SLOSH_LEVEL) return 0
  const t = Math.min(1, (total - SLOSH_LEVEL) / (BREAK_LEVEL - SLOSH_LEVEL))
  return waterMl * SLOSH_PER_S * t * t * (gear.wax ? WAX_SCALE : 1)
}

/** Tilt angles where dribbling starts and where the sieve tips, in degrees. */
export function tiltLimits(assist: boolean): { dribble: number; tip: number } {
  const k = assist ? ASSIST_TILT_SCALE : 1
  return { dribble: DRIBBLE_DEGREES * k, tip: TIP_DEGREES * k }
}

/** Dribble over the rim in mL per second at `tiltDeg`. Wax doesn't help. */
export function dribbleRate(
  waterMl: number,
  tiltDeg: number,
  assist: boolean
): number {
  const { dribble, tip } = tiltLimits(assist)
  if (tiltDeg <= dribble) return 0
  const t = Math.min(1, (tiltDeg - dribble) / (tip - dribble))
  return waterMl * DRIBBLE_PER_S * t * t
}

/** Desktop tilt in degrees for a sieve offset in logical units. */
export function offsetDegrees(offsetX: number, offsetY: number): number {
  return Math.hypot(offsetX, offsetY) * DEGREES_PER_UNIT
}

/** Steadiness zone for a total level. */
export function zoneOf(total: number): Zone {
  if (total >= BREAK_LEVEL) return 'break'
  return total > SLOSH_LEVEL ? 'slosh' : 'green'
}
