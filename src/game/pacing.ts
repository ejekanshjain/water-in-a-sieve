import { settings } from '../shared'
import { Autopilot, skilledPilot, type SkillName } from './autopilot'
import { makeSim, STEP } from './testing'
import { emptyInput, type LossCause } from './types'

/**
 * The pacing measurement behind section 5 of PLAN.md. A seeded skilled player plays a
 * whole game through the real simulation, waits and chores included, and the estimate
 * adds the time a person spends where the simulation never waits for them. Tests and
 * balancing only.
 */

/** One trip, from the lift out of the well until you're back at the well. */
export interface TripSample {
  /** 0 bucket, 1 sink, 2 bathtub. */
  container: number
  capacityMl: number
  scoopedMl: number
  deliveredMl: number
  /** The water drained, or the holes leaked the sieve dry. */
  failed: boolean
  /** Path metres of the drain, with the house at 100, or -1. */
  drainM: number
  /** What drained the sieve, `dry` when the holes leaked it empty, or null. */
  cause: LossCause | 'dry' | null
  /** Lift to arrival back at the well, in ms of simulation time. */
  ms: number
}

/** A whole seeded game, or as much of it as fits in the time limit. */
export interface GameRun {
  ended: boolean
  /** Simulation time from the first step until the ending, or the limit. */
  simMs: number
  trips: TripSample[]
  /** Water the cat drank and the plug let out, over the game. */
  catMl: number
  plugMl: number
  /** How often the cat started drinking and pulled the plug. */
  catTimes: number
  plugTimes: number
  /** Automatic slow-mo replays, upgrades bought and first-time hints seen. */
  replays: number
  purchases: number
  hints: number
  /** Simulation time by scene and phase, such as `path:carry`, in ms. */
  phaseMs: Record<string, number>
}

export interface PlayOptions {
  assist: boolean
  /** Simulation time to give up at, in ms. */
  limitMs: number
}

const PLAY_DEFAULTS: PlayOptions = { assist: false, limitMs: 5 * 3600_000 }

/** Plays one seeded game as the `name` player and records every trip. */
export function playGame(
  name: SkillName,
  seed: number,
  options: Partial<PlayOptions> = {}
): GameRun {
  const { assist, limitMs } = { ...PLAY_DEFAULTS, ...options }
  const before = settings.get().assist
  settings.set({ assist })
  const game = makeSim(seed)
  const { sim } = game
  const s = sim.state
  const pilot = new Autopilot(skilledPilot(name, seed))
  const frame = emptyInput()
  const run: GameRun = {
    ended: false,
    simMs: 0,
    trips: [],
    catMl: 0,
    plugMl: 0,
    catTimes: 0,
    plugTimes: 0,
    replays: 0,
    purchases: 0,
    hints: 0,
    phaseMs: {}
  }
  let trip: TripSample | null = null
  let liftMs = 0
  let t = 0
  for (; t < limitMs && !s.ended; t += STEP) {
    const tripBefore = s.trip
    const key = `${s.scene}:${s.phase}`
    run.phaseMs[key] = (run.phaseMs[key] ?? 0) + STEP
    pilot.frame(sim, frame)
    sim.update(STEP, frame)
    game.clock.now += STEP
    if (s.trip !== tripBefore) {
      trip = {
        container: s.current.container,
        capacityMl: s.capacityMl,
        scoopedMl: s.current.scoopedMl,
        deliveredMl: 0,
        failed: false,
        drainM: -1,
        cause: null,
        ms: 0
      }
      liftMs = t
    }
    for (const event of sim.events) {
      if (event.type === 'catStart') run.catTimes++
      else if (event.type === 'plugPulled') run.plugTimes++
      else if (event.type === 'upgrade') run.purchases++
      else if (event.type === 'drain' && event.record.replay) run.replays++
      if (!trip) continue
      if (event.type === 'poured') trip.deliveredMl += event.ml
      else if (event.type === 'dry') {
        trip.failed = true
        trip.cause = 'dry'
      } else if (event.type === 'drain' && event.scene !== 'well') {
        trip.failed = true
        trip.drainM = event.distance
        trip.cause = event.cause
      }
    }
    sim.events.length = 0
    if (trip && s.scene === 'well') {
      trip.ms = t - liftMs
      run.trips.push(trip)
      trip = null
    }
  }
  settings.set({ assist: before })
  run.ended = s.ended
  run.simMs = t
  for (const ledger of s.containers) {
    run.catMl += ledger.catDrunk
    run.plugMl += ledger.plugDrained
  }
  run.hints = Object.values(s.hintsDone).filter(Boolean).length
  return run
}

/** The start screen, the tray step and the cold open, in seconds. */
const START_S = 60
/** Reading the shop and choosing an upgrade, per purchase. */
const PURCHASE_S = 20
/** Watching an automatic replay at 0.4x and closing it. */
const REPLAY_S = 10
/** Reading a first-time hint and trying what it says. */
const HINT_S = 3

/** Minutes a person takes for this game: the simulation plus what it never waits for. */
export function estimateMinutes(run: GameRun): number {
  const extraS =
    START_S +
    run.purchases * PURCHASE_S +
    run.replays * REPLAY_S +
    run.hints * HINT_S
  return run.simMs / 60_000 + extraS / 60
}

/** Measured rates for one stretch of the game: one container with one sieve size. */
export interface PhaseRates {
  container: number
  capacityMl: number
  trips: number
  /** Share of trips that reached the container with water. */
  successRate: number
  /** Litres delivered per successful trip, as a share of capacity. */
  deliveredShare: number
  /** Mean seconds for a successful trip and for a failed one, lift to well. */
  successS: number
  failS: number
  /** Mean path metres of a drain. */
  drainM: number
}

/** Groups the trips of `runs` by container and sieve size, in game order. */
export function phaseRates(runs: readonly GameRun[]): PhaseRates[] {
  const groups = new Map<string, TripSample[]>()
  for (const run of runs)
    for (const trip of run.trips) {
      const key = `${trip.container}:${trip.capacityMl}`
      const group = groups.get(key)
      if (group) group.push(trip)
      else groups.set(key, [trip])
    }
  const rates: PhaseRates[] = []
  for (const trips of groups.values()) {
    const first = trips[0]
    if (!first) continue
    const wins = trips.filter(trip => !trip.failed)
    const fails = trips.filter(trip => trip.failed)
    const drains = fails.filter(trip => trip.drainM >= 0)
    rates.push({
      container: first.container,
      capacityMl: first.capacityMl,
      trips: trips.length,
      successRate: wins.length / trips.length,
      deliveredShare: mean(wins, trip => trip.deliveredMl / trip.capacityMl),
      successS: mean(wins, trip => trip.ms) / 1000,
      failS: mean(fails, trip => trip.ms) / 1000,
      drainM: mean(drains, trip => trip.drainM)
    })
  }
  return rates.sort(
    (a, b) => a.container - b.container || a.capacityMl - b.capacityMl
  )
}

function mean<T>(items: readonly T[], value: (item: T) => number): number {
  if (items.length === 0) return 0
  let total = 0
  for (const item of items) total += value(item)
  return total / items.length
}
