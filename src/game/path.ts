import { rng, type Rng } from '../shared'
import {
  ASSIST_SLIP_SCALE,
  AUTUMN_LEAF_PILES,
  BUMP_CLEAR_END_M,
  BUMP_FIRST_M,
  BUMP_MIN_GAP_M,
  DRAIN_PATCH_AHEAD_M,
  FIRST_TRIP_BUMP_M,
  MAX_PATCHES,
  PATCH_DRY_TRIPS,
  PATCH_WIDTH_M,
  PATH_METRES,
  ROSE_FROM_M,
  ROSE_TO_M,
  SEGMENT_M,
  SLIP_ICE,
  SLIP_ICE_SLIPPERS,
  SLIP_ICE_SOAKED,
  SLIP_WET,
  SLIP_WET_SLIPPERS,
  SLIP_WET_SOAKED,
  SPRING_PUDDLE_CHANCE,
  WIPE_STROKES,
  WIPE_STROKES_ICE
} from './tuning'
import type { SlipperState } from './kit'
import type { Season } from './types'

/** A slippery patch on the path. */
export interface Patch {
  id: number
  /** Centre, in metres from the well. */
  at: number
  kind: 'wet' | 'ice' | 'leaves'
  /** Trips since it formed; it dries after PATCH_DRY_TRIPS outside winter. */
  age: number
  /** Rub strokes done toward wiping it away. */
  wiped: number
}

export interface PathState {
  /** Bump positions in metres, ascending. */
  bumps: number[]
  /** Seed the bumps came from; a new one reshuffles them. */
  bumpSeed: number
  /** True for bumps a mole hasn't popped out of yet. */
  moles: boolean[]
  patches: Patch[]
  /** The rose bush grows across ROSE_FROM_M to ROSE_TO_M from the sink phase on. */
  rose: boolean
  nextPatchId: number
  /** Paving stones laid, one per SEGMENT_M segment from the well. */
  stones: boolean[]
}

export function createPath(): PathState {
  return {
    bumps: [],
    bumpSeed: -1,
    moles: [],
    patches: [],
    rose: false,
    nextPatchId: 1,
    stones: Array.from({ length: SEGMENT_COUNT }, () => false)
  }
}

/** Paving segments along the path. */
export const SEGMENT_COUNT = PATH_METRES / SEGMENT_M

/** The segment `at` metres falls in, 0 at the well. */
export function segmentOf(at: number): number {
  return Math.max(0, Math.min(SEGMENT_COUNT - 1, Math.floor(at / SEGMENT_M)))
}

/** True when a stone is laid under `at` metres. */
export function pavedAt(path: PathState, at: number): boolean {
  return path.stones[segmentOf(at)] ?? false
}

/**
 * The first unpaved segment an empty walk from `at` metres in direction `dir` reaches,
 * or -1 when every segment that way is paved.
 */
export function firstUnpaved(path: PathState, at: number, dir: 1 | -1): number {
  for (let i = segmentOf(at); i >= 0 && i < path.stones.length; i += dir)
    if (!path.stones[i]) return i
  return -1
}

/** The middle of segment `index`, in metres. */
export function segmentMiddle(index: number): number {
  return (index + 0.5) * SEGMENT_M
}

/**
 * How far ahead segment `index` starts for a walker at `at` going `dir`: 0 inside it,
 * negative once it's behind you.
 */
export function segmentAhead(index: number, at: number, dir: 1 | -1): number {
  const near = dir > 0 ? index * SEGMENT_M : (index + 1) * SEGMENT_M
  const far = dir > 0 ? (index + 1) * SEGMENT_M : index * SEGMENT_M
  if ((at - far) * dir >= 0) return -1
  return Math.max(0, (near - at) * dir)
}

/** True when `at` metres is inside the rose bush. */
export function inRose(path: PathState, at: number): boolean {
  return path.rose && at >= ROSE_FROM_M && at <= ROSE_TO_M
}

/** Distance to the rose bush ahead when walking toward the house, or Infinity. */
export function nextRoseAhead(path: PathState, at: number): number {
  return path.rose && at < ROSE_FROM_M ? ROSE_FROM_M - at : Infinity
}

/**
 * Seeded bump positions: `count` bumps at least 8 m apart, from 10 m, none in the last
 * 5 m. The same seed always gives the same path.
 */
export function makeBumps(count: number, seed: number): number[] {
  const random = rng(seed)
  const last = PATH_METRES - BUMP_CLEAR_END_M
  const span = last - BUMP_FIRST_M - BUMP_MIN_GAP_M * (count - 1)
  // Spread the slack randomly between the gaps, so spacing never breaks the minimum.
  const cuts: number[] = []
  for (let i = 0; i < count; i++) cuts.push(random() * span)
  cuts.sort((a, b) => a - b)
  return cuts.map(
    (cut, i) => Math.round((BUMP_FIRST_M + cut + i * BUMP_MIN_GAP_M) * 10) / 10
  )
}

/**
 * Sets the bumps for a trip. Trip 1 has one teaching bump at 20 m; after that the bumps
 * come from `seed`, and a new seed marks every bump for a mole. Paved segments never
 * get a bump back.
 */
export function layBumps(
  path: PathState,
  trip: number,
  count: number,
  seed: number
): void {
  if (trip === 1) {
    path.bumps = [FIRST_TRIP_BUMP_M]
    path.moles = [false]
    path.bumpSeed = -1
    return
  }
  if (seed === path.bumpSeed) return
  path.bumpSeed = seed
  path.bumps = makeBumps(count, seed).filter(at => !pavedAt(path, at))
  path.moles = path.bumps.map(() => true)
}

/** A stone laid on segment `index` flattens its bumps. Returns how many went. */
export function flattenBumps(path: PathState, index: number): number {
  const before = path.bumps.length
  const moles = path.moles
  path.moles = []
  path.bumps = path.bumps.filter((at, i) => {
    if (segmentOf(at) === index) return false
    path.moles.push(moles[i] ?? false)
    return true
  })
  return before - path.bumps.length
}

/** Index of the first bump crossed between `from` and `to` metres, or -1. */
export function bumpCrossed(path: PathState, from: number, to: number): number {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  for (let i = 0; i < path.bumps.length; i++) {
    const b = path.bumps[i] ?? -1
    if (b > lo && b <= hi) return i
  }
  return -1
}

/** Distance to the next bump ahead when walking toward the house, or Infinity. */
export function nextBumpAhead(path: PathState, at: number): number {
  for (const b of path.bumps) if (b > at) return b - at
  return Infinity
}

/** Width of a patch in metres; it shrinks as it dries. */
export function patchWidth(patch: Patch): number {
  if (patch.kind === 'ice') return PATCH_WIDTH_M
  return PATCH_WIDTH_M * (1 - patch.age / (PATCH_DRY_TRIPS + 1))
}

/** The patch under `at` metres, or null. */
export function patchAt(path: PathState, at: number): Patch | null {
  for (const patch of path.patches)
    if (Math.abs(patch.at - at) <= patchWidth(patch) / 2) return patch
  return null
}

/** Distance to the nearest patch ahead in walking direction `dir`, or Infinity. */
export function nextPatchAhead(
  path: PathState,
  at: number,
  dir: 1 | -1
): number {
  let best = Infinity
  for (const patch of path.patches) {
    const ahead = (patch.at - at) * dir
    if (ahead > 0 && ahead < best) best = ahead
  }
  return best
}

/** Adds a patch of `kind` centred at `at` metres. */
export function addPatch(
  path: PathState,
  at: number,
  kind: Patch['kind']
): Patch {
  const patch: Patch = { id: path.nextPatchId++, at, kind, age: 0, wiped: 0 }
  path.patches.push(patch)
  return patch
}

/** A drain throws the water forward: the wet patch lands ahead of you. */
export function addDrainPatch(path: PathState, at: number): Patch {
  const spot = Math.min(PATH_METRES - 1, Math.max(1, at + DRAIN_PATCH_AHEAD_M))
  return addPatch(path, spot, 'wet')
}

/**
 * A new trip ages every patch. In winter, every patch that's there now freezes and stays.
 * Outside winter, ice melts back to water, puddles dry after PATCH_DRY_TRIPS trips, and
 * leaf piles blow away after one trip. Past MAX_PATCHES, the oldest go too, so a run of
 * drains can't pave the path with ice. Returns the patches that went away.
 */
export function agePatches(path: PathState, season: Season): Patch[] {
  const winter = season === 'winter'
  const gone: Patch[] = []
  const kept: Patch[] = []
  for (const patch of path.patches) {
    patch.age++
    if (patch.kind === 'leaves' && patch.age >= 1) gone.push(patch)
    else if (winter) {
      if (patch.kind === 'wet') {
        patch.kind = 'ice'
        patch.wiped = 0
      }
      kept.push(patch)
    } else if (patch.kind === 'ice') {
      patch.kind = 'wet'
      patch.age = 0
      kept.push(patch)
    } else if (patch.age > PATCH_DRY_TRIPS) gone.push(patch)
    else kept.push(patch)
  }
  // Patches sit in the order they formed, oldest first.
  const extra = Math.max(0, kept.length - MAX_PATCHES)
  gone.push(...kept.splice(0, extra))
  path.patches = kept
  return gone
}

/** True when nothing else lies within 4 m of `at`. */
function freeSpot(path: PathState, at: number): boolean {
  return path.patches.every(p => Math.abs(p.at - at) >= 4)
}

/** Picks a free spot between `from` and `to` metres, or -1 after a few tries. */
function randomSpot(
  path: PathState,
  from: number,
  to: number,
  random: Rng
): number {
  for (let tries = 0; tries < 8; tries++) {
    const at = Math.round((from + random() * (to - from)) * 10) / 10
    if (freeSpot(path, at)) return at
  }
  return -1
}

/**
 * The season's own mess at the start of a trip: spring puddles (40% of trips) and
 * autumn's two wet leaf piles. Returns the patches it added.
 */
export function seasonPatches(
  path: PathState,
  season: Season,
  random: Rng
): Patch[] {
  const added: Patch[] = []
  const piles = season === 'autumn' ? AUTUMN_LEAF_PILES : 0
  for (let i = 0; i < piles; i++) {
    const at = randomSpot(path, 12, 92, random)
    if (at >= 0) added.push(addPatch(path, at, 'leaves'))
  }
  if (season === 'spring' && random() < SPRING_PUDDLE_CHANCE) {
    const at = randomSpot(path, 15, 90, random)
    if (at >= 0) added.push(addPatch(path, at, 'wet'))
  }
  return added
}

/** Rub strokes it takes to wipe a patch away: ice takes longer. */
export function wipeStrokes(kind: Patch['kind']): number {
  return kind === 'ice' ? WIPE_STROKES_ICE : WIPE_STROKES
}

/** Removes a patch from the path. */
export function removePatch(path: PathState, id: number): void {
  path.patches = path.patches.filter(p => p.id !== id)
}

/** The patch with `id`, or null. */
export function patchById(path: PathState, id: number): Patch | null {
  for (const patch of path.patches) if (patch.id === id) return patch
  return null
}

/** Slip speeds by what's on your feet: wet patches and leaf piles, then ice. Barefoot while slippers dry. */
const SLIP_SPEEDS: Record<SlipperState, readonly [number, number]> = {
  none: [SLIP_WET, SLIP_ICE],
  drying: [SLIP_WET, SLIP_ICE],
  dry: [SLIP_WET_SLIPPERS, SLIP_ICE_SLIPPERS],
  soaked: [SLIP_WET_SOAKED, SLIP_ICE_SOAKED]
}

/** Walking faster than this on `kind` slips you, in m/s. */
export function slipSpeed(
  kind: Patch['kind'],
  assist: boolean,
  slippers: SlipperState = 'none'
): number {
  const [wet, ice] = SLIP_SPEEDS[slippers]
  return (kind === 'ice' ? ice : wet) * (assist ? ASSIST_SLIP_SCALE : 1)
}
