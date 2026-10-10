import { createStore, type RealTimer, type Store } from '../shared'
import { CONTAINERS, shownContainer } from './containers'
import type { EndingStats } from './ending'
import type { SlipperState } from './kit'
import type { ShareKind } from './share'
import type { ContextAction, Sim } from './sim'
import type { InputMode, Phase, SceneId, Season } from './types'

/**
 * The small, flat view of the game that React reads. Every field is a primitive or a
 * reference that only changes on discrete events, and litres are rounded to 0.1 L, so a
 * dripping sieve doesn't re-render React every step.
 */
export interface HudSnapshot {
  scene: SceneId
  phase: Phase
  trip: number
  /** Litres in the sieve x 10. */
  sieveTenths: number
  capacityTenths: number
  scoopsLeft: number
  bucketUp: boolean
  refill: RealTimer | null
  glue: RealTimer | null
  /** Soaked slippers drying on the line. */
  slippersTimer: RealTimer | null
  containerName: string
  /** Litres in the current container x 10, and its capacity x 10. */
  containerTenths: number
  containerCapacityTenths: number
  /** The No-Drip badge, shown while you carry and pour. */
  noDrip: 'none' | 'intact' | 'cracked'
  season: Season
  /** The bathtub's last stretch: one sieve left, or one sieve left again after falling short. */
  lastTrip: 'no' | 'last' | 'really'
  /** Holes torn in the mesh. */
  holes: number
  /** The cat is drinking from the container behind your back. */
  catDrinking: boolean
  /** The bathtub plug is out, so the tub drains. */
  plugOut: boolean
  /** The context slot's one button, or null. */
  context: ContextAction | null
  /** What the walk back's Share button would share, or null. */
  share: ShareKind | null
  /** The interviewer's two answers while they wait for yours (E, then F), or null. */
  answerE: string | null
  answerF: string | null
  /** Rain sitting in the tub for now, in litres x 10. */
  rainTenths: number
  paused: boolean
  holdingStill: boolean
  /** Water is in your hands: a mouse can't reach buttons without letting go. */
  atStake: boolean
  /** The shop opens here and now: an empty sieve, at the well or on a house visit. */
  canShop: boolean
  /** Trips of wax left, or -1 without Wax Coating. */
  waxTrips: number
  slippers: SlipperState
  swatter: boolean
  /** Trips the cat stays busy with treats. */
  treatTrips: number
  /** Paving stones still to lay. */
  stonesLeft: number
  inputMode: InputMode
  /** Walk for Real is walking you: the phone is the sieve and your steps count. */
  realWalk: boolean
  hint: string | null
  /** The ending screen's numbers once the tub is full and the ending has played. */
  ending: EndingStats | null
}

export function createHudStore(): Store<HudSnapshot> {
  return createStore<HudSnapshot>({
    scene: 'well',
    phase: 'crank',
    trip: 0,
    sieveTenths: 0,
    capacityTenths: 10,
    scoopsLeft: 0,
    bucketUp: false,
    refill: null,
    glue: null,
    slippersTimer: null,
    containerName: 'Bucket',
    containerTenths: 0,
    containerCapacityTenths: 100,
    noDrip: 'none',
    season: 'summer',
    lastTrip: 'no',
    holes: 0,
    catDrinking: false,
    plugOut: false,
    context: null,
    share: null,
    answerE: null,
    answerF: null,
    rainTenths: 0,
    paused: false,
    holdingStill: false,
    atStake: false,
    canShop: false,
    waxTrips: -1,
    slippers: 'none',
    swatter: false,
    treatTrips: 0,
    stonesLeft: 0,
    inputMode: 'mouse',
    realWalk: false,
    hint: null,
    ending: null
  })
}

/** Publishes at most this often in simulation time, unless forced by a discrete event. */
const PUBLISH_MS = 100

/** Builds and publishes snapshots at 10 Hz of simulation time. */
export class SnapshotPublisher {
  private lastAt = -Infinity
  /** Built once, so the ending screen never re-renders with new numbers. */
  private ending: EndingStats | null = null

  constructor(readonly store: Store<HudSnapshot>) {}

  /** Call every step. `force` publishes now, for discrete events. */
  publish(sim: Sim, inputMode: InputMode, force = false): void {
    const state = sim.state
    if (!force && state.timeMs - this.lastAt < PUBLISH_MS) return
    this.lastAt = state.timeMs
    // The pour that fills a container shows it full until its result goes.
    const shown = shownContainer(state)
    const def = CONTAINERS[shown]
    const ledger = state.containers[shown]
    const carrying =
      state.scene === 'path' ||
      (state.scene === 'house' && state.phase !== 'visit')
    const atStake = sim.atStake()
    this.store.set({
      scene: state.scene,
      phase: state.phase,
      trip: state.trip,
      sieveTenths: Math.round(state.sieve.inSieve / 100),
      capacityTenths: Math.round(state.capacityMl / 100),
      scoopsLeft: state.well.scoopsLeft,
      bucketUp: state.well.bucketUp,
      refill: state.waits.refill,
      glue: state.waits.glue,
      slippersTimer: state.waits.slippers,
      containerName: def?.name ?? '',
      containerTenths: Math.floor((ledger?.inContainer ?? 0) / 100),
      containerCapacityTenths: Math.round((def?.capacityMl ?? 0) / 100),
      noDrip: carrying ? state.current.noDrip : 'none',
      season: state.season,
      lastTrip: sim.lastTripLabel(),
      holes: state.holes.length,
      catDrinking: state.cat.mood === 'drinking',
      plugOut: state.cat.plugOut,
      context: sim.contextAction(),
      share: state.share?.kind ?? null,
      answerE: sim.interviewChoices()?.e ?? null,
      answerF: sim.interviewChoices()?.f ?? null,
      rainTenths:
        shown === 2 ? Math.round((state.containers[2]?.rainMl ?? 0) / 100) : 0,
      paused: state.paused,
      holdingStill: state.holdStillMs > 0,
      atStake,
      canShop: !state.paused && sim.canShop(),
      waxTrips: state.kit.wax ? state.kit.waxTripsLeft : -1,
      slippers: state.kit.slippers,
      swatter: state.kit.swatter,
      treatTrips: state.kit.treatTrips,
      stonesLeft: state.kit.stonesLeft,
      inputMode,
      realWalk: state.realWalk.active,
      hint: sim.hint(inputMode),
      ending: state.ended ? (this.ending ??= sim.endingStats()) : null
    })
  }
}
