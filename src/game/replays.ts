import {
  HOUSE_WALK_METRES,
  PATH_METRES,
  REPLAY_EVERY_TRIPS,
  REPLAY_FIRST_M,
  REPLAY_NEAR_M,
  STEP_METRES
} from './tuning'
import type { LossCause, SceneId } from './types'

/** One drain, as the replay, its label and the share card see it. */
export interface DrainRecord {
  cause: LossCause
  ml: number
  /** Metres along the path; the house counts as 100. */
  distance: number
  trip: number
  scene: SceneId
  /** Metres into the house walk-in, 0 to 4, for "1 step from the tub". */
  walkIn: number
  /** It drained mid-pour, over the container. */
  pouring: boolean
  /** The container this trip was for, by index. */
  container: number
  /** What a full sieve held, for "at least half a sieve". */
  capacityMl: number
  /** An automatic slow-mo replay is due for this drain. */
  replay: boolean
}

/** Which automatic replays have played, so they stay rare. */
export interface ReplayLog {
  /** The first path drain at REPLAY_FIRST_M or more already got its replay. */
  firstDone: boolean
  /** Trip of the latest automatic replay. */
  lastTrip: number
}

export function createReplayLog(): ReplayLog {
  return { firstDone: false, lastTrip: -REPLAY_EVERY_TRIPS }
}

/**
 * True when a drain earns an automatic slow-mo replay, and notes it in the log. The first
 * path drain at 10 m or more gets one, so you learn they exist. After that only the
 * painful ones do: at 85 m or more, or in the house, with at least half a sieve. Either
 * way at most one per 3 trips.
 */
export function claimReplay(
  log: ReplayLog,
  drain: Omit<DrainRecord, 'replay'>
): boolean {
  if (drain.trip - log.lastTrip < REPLAY_EVERY_TRIPS) return false
  const path = drain.scene === 'path'
  const first = path && !log.firstDone && drain.distance >= REPLAY_FIRST_M
  const near =
    drain.scene === 'house' || (path && drain.distance >= REPLAY_NEAR_M)
  const big = drain.ml * 2 >= drain.capacityMl
  if (!first && !(near && big)) return false
  log.lastTrip = drain.trip
  if (path) log.firstDone = true
  return true
}

/** Short names of the containers, for "3 steps from the sink". */
const CONTAINER_WORD: readonly string[] = ['bucket', 'sink', 'tub']

/**
 * Where a drain happened, as the replay's big label: "1 step from the tub", "5 m from
 * the house", "12 m from the well", or "Mid-pour, over the tub".
 */
export function drainSpot(drain: DrainRecord): string {
  if (drain.scene === 'house') {
    const name = CONTAINER_WORD[drain.container] ?? 'tub'
    if (drain.pouring) return `Mid-pour, over the ${name}`
    const steps = Math.max(
      1,
      Math.ceil((HOUSE_WALK_METRES - drain.walkIn) / STEP_METRES)
    )
    return `${steps} ${steps === 1 ? 'step' : 'steps'} from the ${name}`
  }
  if (drain.scene === 'path') {
    if (drain.distance >= PATH_METRES / 2) {
      const left = Math.max(1, Math.ceil(PATH_METRES - drain.distance))
      return `${left} m from the house`
    }
    return `${Math.max(1, Math.floor(drain.distance))} m from the well`
  }
  return 'At the well'
}
