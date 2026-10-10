import type { Leaf } from './leaves'
import {
  CRANK_CIRCLES,
  CRANK_CIRCLES_WINTER,
  SCOOPS_PER_FILL,
  SLAM_CIRCLE_MS,
  WATER_FULL_Y,
  WATER_PER_SCOOP_Y
} from './tuning'

/** The well bucket, the crank and the sieve while scooping. */
export interface WellState {
  /** The bucket hangs above the rim, ready to scoop. */
  bucketUp: boolean
  /** Scoops left in the raised bucket. */
  scoopsLeft: number
  /** Circles cranked toward raising the bucket. */
  crankTurns: number
  /** Fraction of the circle in progress, for drawing the rising bucket. */
  crankProgress: number
  /** Handle angle in radians, for drawing. */
  crankAngle: number
  /** Scoops slopped out by cranking too fast, taken off when the bucket arrives. */
  slopped: number
  /** Side-view y of the sieve while you scoop. */
  sieveY: number
  /** The sieve is under the bucket's water line. */
  dipped: boolean
  /** Water gained in the current dip, in mL. */
  dipGainMl: number
  /** Motion mode: the phone is tipped forward to dip, until it tips back. */
  tipDip: boolean
  /** The "can't scoop" message showed for this dip attempt. */
  blockedShown: boolean
  /** The frog on the crank: absent, sitting, or being dragged. */
  frog: 'none' | 'on' | 'dragging'
  /** Times you have moved the frog off; it hops back once. */
  frogMoves: number
  frogX: number
  frogY: number
  /** Leaves floating in the well water; they come up with the bucket and cut each scoop. */
  leaves: Leaf[]
  nextLeafId: number
}

export function createWell(sieveY: number): WellState {
  return {
    bucketUp: false,
    scoopsLeft: 0,
    crankTurns: 0,
    crankProgress: 0,
    crankAngle: 0,
    slopped: 0,
    sieveY,
    dipped: false,
    dipGainMl: 0,
    tipDip: false,
    blockedShown: false,
    frog: 'none',
    frogMoves: 0,
    frogX: 0,
    frogY: 0,
    leaves: [],
    nextLeafId: 1
  }
}

/** Circles needed to raise the bucket. */
export function crankNeeded(winter: boolean): number {
  return winter ? CRANK_CIRCLES_WINTER : CRANK_CIRCLES
}

/** What one crank circle did. */
export type CrankResult = 'turn' | 'unwind' | 'slam' | 'up'

/**
 * Applies one full crank circle. Clockwise (1) raises the bucket, anticlockwise unwinds
 * one circle, and a circle faster than SLAM_CIRCLE_MS still counts but slops a scoop.
 * Call only when cranking is allowed.
 */
export function crankCircle(
  well: WellState,
  direction: 1 | -1,
  durationMs: number,
  needed: number
): CrankResult {
  if (direction < 0) {
    well.crankTurns = Math.max(0, well.crankTurns - 1)
    return 'unwind'
  }
  well.crankTurns++
  const slam = durationMs < SLAM_CIRCLE_MS
  if (slam) well.slopped = Math.min(SCOOPS_PER_FILL - 1, well.slopped + 1)
  if (well.crankTurns >= needed) {
    well.bucketUp = true
    well.scoopsLeft = SCOOPS_PER_FILL - well.slopped
    well.crankTurns = 0
    well.crankProgress = 0
    well.slopped = 0
    return 'up'
  }
  return slam ? 'slam' : 'turn'
}

/** Letting go mid-crank spins the bucket back down. Returns true when progress was lost. */
export function crankLetGo(well: WellState): boolean {
  if (well.bucketUp || (well.crankTurns === 0 && well.crankProgress < 0.25))
    return false
  well.crankTurns = 0
  well.crankProgress = 0
  well.slopped = 0
  return true
}

/** Water line of the raised bucket for the scoops left. */
export function waterLineY(scoopsLeft: number): number {
  return WATER_FULL_Y + (SCOOPS_PER_FILL - scoopsLeft) * WATER_PER_SCOOP_Y
}
