import type { RealTimer } from '../shared'
import {
  Autopilot,
  DEFAULT_AUTOPILOT,
  type AutopilotOptions
} from './autopilot'
import { Sim } from './sim'
import { emptyInput, type InputFrame } from './types'

/** One fixed simulation step in ms. */
export const STEP = 1000 / 60

/** A sim on a fake wall clock that tests advance with each step. Tests only. */
export interface TestGame {
  sim: Sim
  clock: { now: number }
}

export function makeSim(seed: number): TestGame {
  const clock = { now: 0 }
  return { sim: new Sim(seed, { now: () => clock.now }), clock }
}

/**
 * Plays the autopilot until `done` returns true or `ms` of simulation time pass.
 * `tweak` can change each frame before it is applied.
 */
export function runPilot(
  game: TestGame,
  done: () => boolean,
  ms = 120_000,
  tweak?: (frame: InputFrame) => void,
  options: Partial<AutopilotOptions> = {}
): void {
  const pilot = new Autopilot({ ...DEFAULT_AUTOPILOT, ...options })
  const frame = emptyInput()
  for (let t = 0; t < ms && !done(); t += STEP) {
    pilot.frame(game.sim, frame)
    tweak?.(frame)
    game.sim.update(STEP, frame)
    game.clock.now += STEP
  }
}

/** Steps the sim with a fixed frame for `ms`. */
export function hold(game: TestGame, frame: InputFrame, ms: number): void {
  for (let t = 0; t < ms; t += STEP) {
    game.sim.update(STEP, frame)
    game.clock.now += STEP
  }
}

/** A frame that keeps holding the sieve at (x, y). */
export function gripFrame(x: number, y: number): InputFrame {
  const frame = emptyInput()
  frame.grip = true
  frame.gripId = 1
  frame.x = x
  frame.y = y
  return frame
}

/** A wait that blocks the well, as a pilot lived through it. */
export interface WaitRecord {
  kind: 'refill' | 'glue'
  /** Chores open on the step the wait started. */
  choresAtStart: number
  /** Time the pilot stood at the well with nothing to do, in ms. */
  idleMs: number
}

/**
 * Plays `pilot` until `done` returns true or `ms` of simulation time pass, and records
 * every refill and glue wait. Tests only.
 */
export function playWithWaits(
  game: TestGame,
  pilot: Autopilot,
  done: () => boolean,
  ms: number
): WaitRecord[] {
  const { sim } = game
  const s = sim.state
  const frame = emptyInput()
  const waits: WaitRecord[] = []
  let refill: RealTimer | null = s.waits.refill
  let glue: RealTimer | null = s.waits.glue
  let current: WaitRecord | null = null
  for (let t = 0; t < ms && !done(); t += STEP) {
    pilot.frame(sim, frame)
    sim.update(STEP, frame)
    sim.events.length = 0
    game.clock.now += STEP
    for (const kind of ['refill', 'glue'] as const) {
      const timer = s.waits[kind]
      if (timer && timer !== (kind === 'refill' ? refill : glue)) {
        current = { kind, choresAtStart: sim.chores.list().length, idleMs: 0 }
        waits.push(current)
      }
    }
    refill = s.waits.refill
    glue = s.waits.glue
    if (!refill && !glue) current = null
    if (current && pilot.idle) current.idleMs += STEP
  }
  return waits
}
