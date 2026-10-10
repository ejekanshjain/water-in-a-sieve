import type { Hole } from './holes'
import {
  BENCH_RADIUS,
  BENCH_X,
  BENCH_Y,
  EYE_SHAKE_GAIN,
  EYE_SWAY,
  EYE_SWAY_HZ,
  STITCH_RING
} from './tuning'

/** The workbench at the well: thread the needle, sew each hole, then glue; or rewax. */
export interface BenchState {
  open: boolean
  /** Mending holes, or rubbing the wax back on. */
  mode: 'mend' | 'wax'
  /** The needle is threaded; it stays threaded until the glue goes on. */
  threaded: boolean
  /** Seconds of sway, for the needle's eye. */
  swayS: number
  /** How shaky your hands are at the bench, 0 to 1; it swings the eye further. */
  shake: number
  /** Where your pointer holds the thread or needle, for drawing, and whether it's held. */
  handX: number
  handY: number
  holding: boolean
}

export function createBench(): BenchState {
  return {
    open: false,
    mode: 'mend',
    threaded: false,
    swayS: 0,
    shake: 0,
    handX: 0,
    handY: 0,
    holding: false
  }
}

/** What the bench is waiting for. */
export type BenchStage = 'thread' | 'sew' | 'glue' | 'wax'

export function benchStage(
  bench: BenchState,
  holes: readonly Hole[]
): BenchStage {
  if (bench.mode === 'wax') return 'wax'
  if (!bench.threaded) return 'thread'
  return holes.some(h => !isSewn(h)) ? 'sew' : 'glue'
}

export function isSewn(hole: Hole): boolean {
  return hole.stitched >= hole.points
}

/** The needle's eye x: it sways, further the shakier your hands. */
export function eyeX(swayS: number, shake: number): number {
  const reach = EYE_SWAY * (1 + EYE_SHAKE_GAIN * shake)
  return BENCH_X + Math.sin(swayS * EYE_SWAY_HZ * Math.PI * 2) * reach
}

/** A hole's centre on the bench view of the sieve. */
export function benchHole(hole: Hole, out: { x: number; y: number }) {
  const r = hole.dist * (BENCH_RADIUS - 46)
  out.x = BENCH_X + Math.cos(hole.angle) * r
  out.y = BENCH_Y + Math.sin(hole.angle) * r
  return out
}

/** Stitch point `index` around a hole on the bench, clockwise from the top. */
export function stitchPoint(
  hole: Hole,
  index: number,
  out: { x: number; y: number }
): { x: number; y: number } {
  benchHole(hole, out)
  const a = -Math.PI / 2 + (index / hole.points) * Math.PI * 2
  out.x += Math.cos(a) * STITCH_RING
  out.y += Math.sin(a) * STITCH_RING
  return out
}

/**
 * Sews `index` into `hole`. The next point in order stitches; any later point unpicks the
 * last stitch, so you have to go round in order.
 */
export function sewPoint(
  hole: Hole,
  index: number
): 'stitch' | 'unpick' | 'none' {
  if (isSewn(hole) || index < hole.stitched) return 'none'
  if (index === hole.stitched) {
    hole.stitched++
    return 'stitch'
  }
  if (hole.stitched === 0) return 'unpick'
  hole.stitched--
  return 'unpick'
}
