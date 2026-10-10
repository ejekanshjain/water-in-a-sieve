import { drainContainer, type ContainerLedger } from './containers'
import {
  CAT_DRINK_ML_PER_S,
  CAT_MIN_ML,
  PLUG_FIX_RADIUS,
  PLUG_HOLE_X,
  PLUG_HOLE_Y,
  PLUG_ML_PER_S,
  PLUG_REST_X,
  PLUG_REST_Y
} from './tuning'

/** The cat's mischief in the house: drinking your water and pulling the tub's plug. */
export interface CatState {
  /** Away, or drinking from the container you're filling. */
  mood: 'away' | 'drinking'
  /** The cat pulled the bathtub plug, so the tub drains. */
  plugOut: boolean
  /** The plug is in your fingers, at (plugX, plugY), while you drag it back. */
  plugHeld: boolean
  plugX: number
  plugY: number
}

export function createCat(): CatState {
  return {
    mood: 'away',
    plugOut: false,
    plugHeld: false,
    plugX: PLUG_REST_X,
    plugY: PLUG_REST_Y
  }
}

/** The cat only bothers with a container holding 2 L or more that isn't full yet. */
export function catWants(ledger: ContainerLedger): boolean {
  return !ledger.done && ledger.inContainer >= CAT_MIN_ML
}

/**
 * One step of the cat drinking from the `current` container and the open plughole
 * draining the `tub`. Both run on simulation time, so a paused game loses nothing.
 * Returns the whole mL lost this step.
 */
export function stepCatLosses(
  cat: CatState,
  current: ContainerLedger,
  tub: ContainerLedger | undefined,
  dtMs: number
): number {
  const dt = dtMs / 1000
  let lost = 0
  if (cat.mood === 'drinking')
    lost += drainContainer(current, 'cat', CAT_DRINK_ML_PER_S * dt)
  if (cat.plugOut && tub)
    lost += drainContainer(tub, 'plug', PLUG_ML_PER_S * dt)
  return lost
}

/** True when a plug dropped at (x, y) lands in the plughole. */
export function plugFits(x: number, y: number): boolean {
  return Math.hypot(x - PLUG_HOLE_X, y - PLUG_HOLE_Y) <= PLUG_FIX_RADIUS
}
