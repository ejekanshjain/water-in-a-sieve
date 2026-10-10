import { STEP_METRES, type WalkMode } from './tuning'

export interface Walker {
  /** Metres from the well along the path. */
  distance: number
  /** Speed in m/s, never negative. */
  speed: number
  /** 1 walks toward the house, -1 toward the well. */
  dir: 1 | -1
  /** Metres walked since the last footstep. */
  stride: number
  /** Footsteps taken this walk, for the bob and footstep sounds. */
  steps: number
}

export function createWalker(distance = 0, dir: 1 | -1 = 1): Walker {
  return { distance, speed: 0, dir, stride: 0, steps: 0 }
}

/**
 * Advances the walker one step. Holding walk ramps speed up; letting go slows down.
 * Returns true when a footstep landed this step.
 */
export function stepWalker(
  walker: Walker,
  holding: boolean,
  mode: WalkMode,
  dtMs: number
): boolean {
  const dt = dtMs / 1000
  walker.speed = holding
    ? Math.min(mode.top, walker.speed + mode.accel * dt)
    : Math.max(0, walker.speed - mode.decel * dt)
  const moved = walker.speed * dt
  walker.distance += moved * walker.dir
  walker.stride += moved
  if (walker.stride < STEP_METRES) return false
  walker.stride -= STEP_METRES
  walker.steps++
  return true
}

/** Phase of the current stride, 0 to 1, for the bob and leg swing. */
export function stridePhase(walker: Walker): number {
  return walker.stride / STEP_METRES
}
