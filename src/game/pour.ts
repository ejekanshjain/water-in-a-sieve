import { clamp } from '../shared'
import {
  POUR_KEY_DOWN,
  POUR_KEY_UP,
  POUR_MAX_LPS,
  POUR_RANGE,
  POUR_SAFE_LPS,
  POUR_START,
  SPLASH_MAX
} from './tuning'

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Pour flow in L/s for a pour value from 0 to 1. */
export function pourFlow(value: number): number {
  return POUR_MAX_LPS * smoothstep(POUR_START, 1, value)
}

/** Share of the flow that splashes instead of landing in the container. */
export function splashFraction(flowLps: number): number {
  return clamp(
    (flowLps - POUR_SAFE_LPS) / (POUR_MAX_LPS - POUR_SAFE_LPS),
    0,
    SPLASH_MAX
  )
}

/** Pour value from the pointer's offset right of the anchor taken when the pour began. */
export function pointerPour(x: number, anchorX: number): number {
  return clamp((x - anchorX) / POUR_RANGE, 0, 1)
}

/** Steps the key pour value: D (1) raises it slowly and it holds; A (-1) lowers it. */
export function stepKeyPour(value: number, axis: number, dtMs: number): number {
  const dt = dtMs / 1000
  if (axis > 0) return Math.min(1, value + POUR_KEY_UP * dt)
  if (axis < 0) return Math.max(0, value - POUR_KEY_DOWN * dt)
  return value
}

/** The pointer offset right of the anchor that gives `value`; the inverse of `pointerPour`. */
export function pointerPourOffset(value: number): number {
  return clamp(value, 0, 1) * POUR_RANGE
}
