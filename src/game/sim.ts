import {
  createChoreBoard,
  createShop,
  createWallet,
  isDone,
  JoltMeter,
  now as wallClock,
  rng,
  settings,
  startTimer,
  timeLeftMs,
  type ChoreBoard,
  type RealTimer,
  type Rng,
  type Shop,
  type Wallet
} from '../shared'
import { createCallLog, nextCaller, type CallLog, type Caller } from './calls'
import { litres } from './captions'
import * as carry from './carry'
import { catWants, createCat, stepCatLosses, type CatState } from './cat'
import {
  benchStage,
  createBench,
  eyeX,
  isSewn,
  sewPoint,
  type BenchState
} from './bench'
import {
  CAT_CHORE,
  directorPicks,
  FROG_CHORE,
  LEAVES_CHORE,
  MEND_CHORE,
  patchChore,
  REWAX_CHORE,
  WIPE_FLOOR_CHORE,
  type ChoreKind,
  type DirectorMoment
} from './chores'
import {
  CONTAINERS,
  createContainers,
  receive,
  roomMl,
  type ContainerLedger
} from './containers'
import { createDrift, stepDrift, type Drift } from './drift'
import { coinsFor, noDripBonus, startingNoDrip } from './economy'
import { endingStats, type EndingStats } from './ending'
import {
  createEvent,
  endEvent,
  rollBathroomThreat,
  rollCarryEvent,
  type CarryEvent,
  type CarryEventId,
  type EventOutcome,
  type LeafSpot
} from './events'
import {
  createHintsDone,
  hintFor,
  type HintContext,
  type HintsDone
} from './hints'
import { holeLeakRate, tearHole, type Hole } from './holes'
import * as kit from './kit'
import {
  createKit,
  gaitScale,
  UPGRADES,
  type JokeBlocker,
  type JokeId,
  type KitState,
  type SieveUpgrade,
  type UpgradeId
} from './kit'
import { createRain, stepRain, type RainGag, type RainState } from './rain'
import {
  claimReplay,
  createReplayLog,
  type DrainRecord,
  type ReplayLog
} from './replays'
import type { ShareMoment } from './share'
import { crankLeaves, leafCapacity, scatterLeaves } from './leaves'
import {
  addWater,
  createLedger,
  isBalanced,
  leak,
  moveAll,
  type SieveLedger
} from './ledger'
import {
  baseDripRate,
  capacityMl,
  dribbleRate,
  NO_GEAR,
  offsetDegrees,
  sieveWeight,
  sloshRate,
  tiltLimits,
  zoneOf,
  type SieveGear
} from './sieve'
import {
  createRealWalk,
  detectStep,
  resetRealWalk,
  stepPulse,
  stepRealWalker,
  type RealWalk
} from './steps'
import * as stones from './stones'
import { createStoneWalk, type StoneWalk } from './stones'
import {
  addDrainPatch,
  agePatches,
  bumpCrossed,
  createPath,
  inRose,
  patchById,
  removePatch,
  seasonPatches,
  wipeStrokes,
  layBumps,
  nextPatchAhead,
  pavedAt,
  patchAt,
  patchWidth,
  slipSpeed,
  type Patch,
  type PathState
} from './path'

import { laterSeason, seasonFor, seasonIndex, startsYearTwo } from './seasons'
import { BodyLevel, bumpAmplitude, gait, totalLevel } from './steadiness'
import {
  CONTAINER_DONE,
  CUTSCENES,
  isCutscene,
  MILESTONE_LINES,
  milestoneGag,
  milestonesPassed
} from './story'
import * as trouble from './trouble'
import {
  pointerPour,
  pointerPourOffset,
  pourFlow,
  splashFraction,
  stepKeyPour
} from './pour'
import {
  ASSIST_SUGGEST_DRAINS,
  BREAK_LEVEL,
  BUMP_NUDGE_MS,
  BUMP_NUDGE_UNITS,
  BLOW_PULSE,
  FLOOR_PUDDLE_HALF_M,
  FLOOR_PUDDLE_M,
  FLOOR_WARN_M,
  PAVED_GAIT,
  BUMP_PULSE_MS,
  BUMPS_PER_CONTAINER,
  DEGREES_PER_UNIT,
  DIRECTOR_CAT_SHARE,
  DIRECTOR_MIN_LEFT_S,
  CARRY_WALK,
  CRANK_X,
  EVENT_FROM_M,
  EVENT_TO_M,
  CRANK_Y,
  CRANK_RADIUS,
  DUMP_KEPT,
  EMPTY_ML,
  EYE_SHAKE_SPEED,
  FATIGUE_CAPTION_S,
  FATIGUE_START_S,
  FILL_TAU_FINE_S,
  FILL_TAU_S,
  FLOOR_SPLASH_ML,
  FROG_DROP_DISTANCE,
  GLUE_MS,
  HAND_ASSIST_SCALE,
  HAND_FALL,
  HAND_RISE,
  HOLD_STILL_MS,
  HOUSE_WALK,
  HOUSE_WALK_METRES,
  LIFT_Y,
  MIN_CARRY_FRACTION,
  MIN_SCOOP_FRACTION,
  MOTION_DIP_DEGREES,
  MOTION_DIP_SPEED,
  MOTION_LIFT_DEGREES,
  MOTION_LIFT_SPEED,
  MOTION_POUR_DEGREES,
  MOTION_REF,
  PATH_METRES,
  POINTER_REF,
  PRATFALL_MS,
  REAL_HAND_SCALE,
  REAL_STEP_PULSE_MS,
  REFILL_MS,
  REGRAB_PULSE,
  REGRAB_PULSE_MS,
  REGRAB_WINDOW_MS,
  RESULT_MS,
  ROSE_CONTAINER,
  ROSE_SAFE_SPEED,
  ROSE_TO_M,
  RUN_WALK,
  SIEVE_DEEPEST_Y,
  SIEVE_HOVER_Y,
  SKIP_GUARD_MS,
  SLIP_PULSE,
  SLIP_PULSE_MS,
  STEP_BOB,
  WARN_AHEAD_M,
  WIPE_AHEAD_M,
  WIPE_BEHIND_M,
  WIPE_STOP_SPEED,
  WIPE_STROKES
} from './tuning'
import type {
  CutsceneId,
  InputFrame,
  InputMode,
  LossCause,
  Phase,
  SceneId,
  Season,
  Zone
} from './types'
import { createWalker, stepWalker, stridePhase, type Walker } from './walker'
import {
  crankCircle,
  crankLetGo,
  crankNeeded,
  createWell,
  waterLineY,
  type CrankResult,
  type WellState
} from './well'

/** One trip's record, reset when a trip starts. */
export interface TripRecord {
  trip: number
  /** Water in the sieve when it left the well. */
  scoopedMl: number
  /** Losses you caused (slosh, dribble, holes, splash, drains), for the No-Drip rule. */
  countedLossMl: number
  maxDistance: number
  deliveredMl: number
  splashedMl: number
  /** Index of the container this trip pours into. */
  container: number
  /** The No-Drip badge: only a near-full scoop starts it intact; any loss you cause cracks it. */
  noDrip: 'none' | 'intact' | 'cracked'
  /** The rose bush already tore a hole this trip. */
  roseTorn: boolean
  /** The tub's remaining litres fitted in one sieve when this trip started. */
  lastTrip: boolean
}

export interface SessionStats {
  /** Wall-clock time of the start tap, and of the full tub (0 until then). */
  startedAt: number
  endedAt: number
  trips: number
  drains: number
  scoops: number
  deliveredMl: number
  lostByCause: Record<LossCause, number>
  /** Drains by cause, for captions that count ("Third fly today."). */
  drainsByCause: Record<LossCause, number>
  /** Flies that gave up after you blew them away. */
  fliesBlown: number
  /** Flies you swatted. */
  fliesSwatted: number
}

export type { DrainRecord } from './replays'

/** The rub area open now: a patch on the path, or the puddle on the house floor. */
export interface WipeState {
  target: 'path' | 'floor'
  /** The path patch being wiped; -1 for the floor. */
  patchId: number
  needed: number
  /** Where your sponge is, for drawing, and whether it's pressed. */
  handX: number
  handY: number
  holding: boolean
}

/** The one button in the context slot. */
export type ContextAction =
  /** Answer or Decline a ringing call. */
  | 'call'
  /** Pick one of the interviewer's two answers. */
  | 'interview'
  /** Swing the swatter at a fly or a falling leaf. */
  | 'swat'
  | 'wipe'
  | 'scrape'
  | 'sweep'
  /** Lay a paving stone on the segment just ahead. */
  | 'stone'
  /** Share a card of this trip's drain, near miss or milestone, on the walk back. */
  | 'share'
  | 'goHouse'
  | 'goWell'
  /** Last Trip on a phone: turn on Walk for Real. */
  | 'realWalk'

export interface Waits {
  refill: RealTimer | null
  /** Glue on fresh stitches; scooping waits for it. */
  glue: RealTimer | null
  /** Soaked slippers on the washing line; you go barefoot meanwhile. */
  slippers: RealTimer | null
}

export interface GameState {
  scene: SceneId
  phase: Phase
  /** Time in the current phase, in ms of simulation time. */
  phaseMs: number
  paused: boolean
  /** Countdown after a resume; the world holds still until it reaches 0. */
  holdStillMs: number
  /** Trips started: each lift out of the well starts one. */
  trip: number
  /** Simulation clock in ms. */
  timeMs: number
  gear: SieveGear
  capacityMl: number
  sieve: SieveLedger
  steady: { hand: number; body: number; total: number; zone: Zone }
  grip: {
    held: boolean
    /** Pointer position at the grip press, moved to keep the offset continuous. */
    anchorX: number
    anchorY: number
    /** Where the sieve sits relative to your hands' target: pointer - anchor + drift. */
    offsetX: number
    offsetY: number
    /** Letting go starts this countdown; a fresh press before 0 catches the sieve. */
    tipMs: number
    /** Latest grip position while held. */
    x: number
    y: number
  }
  tiltDeg: number
  /** True while the tilt is past the dribble angle. */
  dribbling: boolean
  drift: Drift
  /** Time spent carrying water this trip, for arm fatigue. */
  carryMs: number
  walker: Walker
  /** Walk for Real: your real steps walk you while the phone is the sieve. */
  realWalk: RealWalk
  /** The input set in use at the latest step. */
  inputMode: InputMode
  /** The current pause came from another input taking over while water was at stake. */
  inputSwitched: boolean
  /** Bumps and wet patches on the garden path. */
  path: PathState
  /** A bump's downward nudge on the sieve, counting down. */
  nudgeMs: number
  /** Sitting on the path after an empty-walk slip, counting down. */
  pratfallMs: number
  well: WellState
  waits: Waits
  /** Which container you're filling: 0 bucket, 1 sink, 2 bathtub. */
  containerIndex: number
  containers: ContainerLedger[]
  /** Follows progress and never turns back. */
  season: Season
  /** Holes torn in the mesh; each leaks while you carry until it's sewn. */
  holes: Hole[]
  /** The workbench at the well, where holes get sewn and glued. */
  bench: BenchState
  nextHoleId: number
  /** Bathtub milestones already celebrated, 0 to 3. */
  milestonesShown: number
  /** A Last Trip fell short, so the label now reads "Last Trip (Really)". */
  lastTripMissed: boolean
  /** The cutscene to play once the pour result has shown. */
  pendingCutscene: CutsceneId | null
  /** This trip's carry event, rolled when the scoop lifts, or null. */
  event: CarryEvent | null
  /** A dev-triggered event waiting for the next carry, or null. */
  queuedEvent: CarryEvent | null
  /** You're blowing at something while carrying, for the puff and the wind sound. */
  blowing: boolean
  /** The trip each carry event last happened on, so none comes back too soon. */
  eventTrips: Partial<Record<CarryEventId, number>>
  /** The rub area open now, or null. */
  wipe: WipeState | null
  /** The patch the Wipe prompt points at on an empty walk, or -1. */
  promptPatch: number
  /** This empty walk's chance to lay a paving stone. */
  stone: StoneWalk
  /**
   * A patch you already slipped on or are wiping can't trip you again until you step off
   * it, so getting up never starts another pratfall. -1 for none.
   */
  safePatch: number
  house: {
    /** A splash left a wet patch on the floor. */
    floorPatch: boolean
    /** Rub strokes done on the floor puddle. */
    floorWiped: number
    /** Walk was let go since the visit began, so holding it now means leave. */
    leaveArmed: boolean
    /** Pour value 0 to 1, from the pointer or the keys. */
    pourValue: number
    /** The key-driven part of the pour, which holds when you let go of D. */
    keyPour: number
    /** Pointer x when the pour began; the pour axis reads from here. */
    pourAnchorX: number
    /** Current flow in L/s, for the gauge, the stream and sounds. */
    flow: number
  }
  /** The cat drinking your water and pulling the tub's plug. */
  cat: CatState
  /** Who's called, who calls back, and your interview answer. */
  calls: CallLog
  /** Spring rain through the bathroom skylight. */
  rain: RainState
  /** Upgrades and joke buys beyond the sieve itself, and their upkeep. */
  kit: KitState
  current: TripRecord
  stats: SessionStats
  lastDrain: DrainRecord | null
  /** Which automatic slow-mo replays have played. */
  replays: ReplayLog
  /** A card worth sharing on this walk back, or null. */
  share: ShareMoment | null
  /** The bathtub is full and the ending has played: the game is over. */
  ended: boolean
  /** Litres of the latest delivery, for the result caption. */
  lastDeliveredMl: number
  /** One line about the last trip, shown on the walk back. */
  tripReport: string
  hintsDone: HintsDone
  /** Drains since the last delivery; enough in a row suggests Assist Mode once. */
  drainStreak: number
  assistSuggested: boolean
  /** Counters the renderer turns into particles and sounds, then zeroes. */
  fx: { dripMl: number; sloshMl: number; dribbleMl: number; holeMl: number }
}

/** Discrete things that happened, for effects, sounds and the HUD. */
export type SimEvent =
  | {
      type: 'drain'
      cause: LossCause
      ml: number
      distance: number
      big: boolean
      scene: SceneId
      /** The full record, including whether an automatic replay is due. */
      record: DrainRecord
    }
  | {
      type: 'poured'
      ml: number
      coins: number
      bonus: number
      dumped: boolean
    }
  | { type: 'noDripCracked' }
  | { type: 'containerDone'; index: number; name: string; bonus: number }
  /** `quiet` when a container cutscene announces the new season itself. */
  | { type: 'season'; season: Season; quiet: boolean }
  | { type: 'hole'; cause: 'rose' | 'ice' | 'dev' }
  | { type: 'yearTwo' }
  /** The sieve leaked dry through its holes before you got there. */
  | { type: 'dry' }
  | { type: 'lastTrip'; really: boolean }
  /** A Last Trip poured, and the tub is still this far from full. */
  | { type: 'nearMiss'; shortMl: number }
  /** The ending cutscene finished: the ending screen takes over. */
  | { type: 'ended' }
  | { type: 'floorSplash' }
  | {
      type: 'wipeOpen'
      target: 'path' | 'floor'
      kind: 'wet' | 'ice' | 'leaves'
    }
  | { type: 'rub'; progress: number }
  | { type: 'wiped'; target: 'path' | 'floor' }
  | { type: 'patchChore'; at: number }
  | { type: 'bump'; index: number; mole: boolean; speed: number }
  | { type: 'slip'; kind: Patch['kind']; carrying: boolean }
  | { type: 'patch'; at: number }
  | { type: 'grip' }
  | { type: 'catch' }
  | { type: 'footstep'; speed: number }
  /** Walk for Real counted a step; `stomp` when it landed hard enough to break. */
  | { type: 'realStep'; peak: number; stomp: boolean }
  /** Walk for Real turned on or off. */
  | { type: 'realWalk'; on: boolean }
  | { type: 'pause' }
  /** Another input took over while water was at stake, which pauses the game. */
  | { type: 'inputSwitched'; mode: InputMode }
  | { type: 'resume' }
  | { type: 'fatigue' }
  | { type: 'scene'; scene: SceneId }
  | { type: 'dip' }
  | { type: 'scoop'; left: number }
  | { type: 'crank'; result: CrankResult; turns: number }
  | { type: 'crankSpin' }
  | { type: 'blocked'; message: string }
  | { type: 'refill' }
  | { type: 'refillDone' }
  | { type: 'frog' }
  | { type: 'frogBack' }
  | { type: 'frogGone' }
  | { type: 'bench'; open: boolean; holes: number; mode: 'mend' | 'wax' }
  | { type: 'thread'; hit: boolean }
  | { type: 'stitch'; result: 'stitch' | 'unpick'; sewn: boolean }
  | { type: 'glue' }
  | { type: 'glueDone' }
  | { type: 'suggestAssist' }
  /** Leaves landed in the well water: with a crank, on the wind, or from dev tools. */
  | { type: 'leavesIn'; count: number; cause: 'crank' | 'wind' | 'dev' }
  | { type: 'leafOut'; left: number }
  /** A dip with leaves in the water: they cling to the mesh and cut the scoop. */
  | { type: 'clogged'; leaves: number }
  /** A carry event started warning you. */
  | { type: 'eventStart'; id: CarryEventId }
  /** Something happened in the carry event, such as a blow or a held-in sneeze. */
  | { type: 'eventStep'; id: CarryEventId; outcome: EventOutcome }
  /**
   * An event that never got you: the house kept it out (`door`), or the pour ended with
   * nothing left to spill (`empty`).
   */
  | { type: 'eventMissed'; id: CarryEventId; where: 'door' | 'empty' }
  /** Carrying near the house with its floor still wet. */
  | { type: 'floorWarn' }
  /** The cat started drinking from the container; `scene` is where you were. */
  | { type: 'catStart'; scene: SceneId }
  /** You walked into the house and caught the cat drinking. */
  | { type: 'catSeen' }
  | { type: 'catShooed'; room: number }
  | { type: 'plugPulled'; scene: SceneId }
  | { type: 'plugFixed' }
  /** The plug was dropped short of the hole and swung back onto the rim. */
  | { type: 'plugMiss' }
  /** You answered or declined a call, or answered the interviewer's question. */
  | { type: 'call'; caller: Caller; what: 'answered' | 'declined' | 'chose' }
  /** Spring rain started, stopped, or finished draining back out of the tub. */
  | { type: 'rain'; stage: 'start' | 'stopped' | 'gone'; gag: RainGag }
  /** The shop sold you an upgrade. */
  | { type: 'upgrade'; id: UpgradeId }
  /** A coin went down the well; `frog` when it brought the frog back. */
  | { type: 'wish'; frog: boolean }
  | { type: 'treats' }
  | { type: 'hat' }
  /** The wax wore off, a rub stroke put some back, or it's all back on. */
  | { type: 'waxWorn' }
  | { type: 'waxRub'; progress: number }
  | { type: 'waxed' }
  | { type: 'slippersSoaked' }
  | { type: 'slippersHung' }
  | { type: 'slippersDry' }
  /** A swatter swing; `target` when a fly or leaf was in reach. */
  | { type: 'swing'; target: boolean }
  /** A paving stone came out beside you, or went into its segment. */
  | { type: 'stoneOut' }
  /** `flattened` counts the bumps the stone buried. */
  | { type: 'stoneLaid'; segment: number; left: number; flattened: number }

const ALL_CAUSES: readonly LossCause[] = [
  'drip',
  'jolt',
  'bump',
  'tilt',
  'letGo',
  'fly',
  'leaves',
  'sneeze',
  'dog',
  'ring',
  'ice',
  'wetFloor',
  'splash',
  'swat',
  'cat',
  'stomp'
]

function emptyCauses(): Record<LossCause, number> {
  const out = {} as Record<LossCause, number>
  for (const cause of ALL_CAUSES) out[cause] = 0
  return out
}

export interface SimOptions {
  /** Wall clock for real-time waits; tests pass a fake one. */
  now?: () => number
}

/**
 * The one mutable game simulation. The loop calls `update` at a fixed 60 Hz with an
 * `InputFrame`; scenes and the autopilot call gesture commands such as `crankCircle`.
 * It never touches the DOM.
 */
export class Sim {
  readonly state: GameState
  /** Hand steadiness: the shared meter, so Sensitivity and Assist Mode scale it. */
  readonly hand = new JoltMeter({
    limit: BREAK_LEVEL,
    motionRef: MOTION_REF,
    pointerRef: POINTER_REF,
    rise: HAND_RISE,
    fall: HAND_FALL,
    assistScale: HAND_ASSIST_SCALE
  })
  readonly body = new BodyLevel()
  /** Open chores. The HUD lists them; the director fills waits with them. */
  readonly chores: ChoreBoard = createChoreBoard()
  /** Coins from deliveries and bonuses. */
  readonly wallet: Wallet = createWallet()
  /** Upgrades for sale, paid from the wallet. */
  readonly shop: Shop<SieveUpgrade>
  /** Events from recent steps. The renderer drains it once per frame. */
  readonly events: SimEvent[] = []
  /** The seeded random source for every roll. */
  readonly random: Rng
  /** Wall clock for real-time waits. */
  readonly now: () => number
  private fatigueCaptioned = false
  /** The peak of a real step that landed this update, in m/s², or 0. */
  private stepPeak = 0
  private readonly hintContext: Required<HintContext> = {
    atStake: false,
    rewaxOpen: false,
    canShop: false,
    offerRealWalk: false
  }

  constructor(seed = 1, { now = wallClock }: SimOptions = {}) {
    this.random = rng(seed)
    this.now = now
    this.shop = createShop(UPGRADES, this.wallet)
    const gear = { ...NO_GEAR }
    this.state = {
      scene: 'well',
      phase: 'crank',
      phaseMs: 0,
      paused: false,
      holdStillMs: 0,
      trip: 0,
      timeMs: 0,
      gear,
      capacityMl: capacityMl(gear),
      sieve: createLedger(),
      steady: { hand: 0, body: 0, total: 0, zone: 'green' },
      grip: {
        held: false,
        anchorX: 0,
        anchorY: 0,
        offsetX: 0,
        offsetY: 0,
        tipMs: 0,
        x: 0,
        y: 0
      },
      tiltDeg: 0,
      dribbling: false,
      drift: createDrift(this.random),
      carryMs: 0,
      walker: createWalker(),
      realWalk: createRealWalk(),
      inputMode: 'mouse',
      inputSwitched: false,
      path: createPath(),
      nudgeMs: 0,
      pratfallMs: 0,
      well: createWell(SIEVE_HOVER_Y),
      waits: { refill: null, glue: null, slippers: null },
      containerIndex: 0,
      containers: createContainers(),
      season: 'summer',
      holes: [],
      bench: createBench(),
      nextHoleId: 1,
      milestonesShown: 0,
      lastTripMissed: false,
      pendingCutscene: null,
      event: null,
      queuedEvent: null,
      blowing: false,
      eventTrips: {},
      wipe: null,
      promptPatch: -1,
      stone: createStoneWalk(),
      safePatch: -1,
      house: {
        floorPatch: false,
        floorWiped: 0,
        leaveArmed: false,
        pourValue: 0,
        keyPour: 0,
        pourAnchorX: 0,
        flow: 0
      },
      cat: createCat(),
      calls: createCallLog(),
      rain: createRain(),
      kit: createKit(),
      current: {
        trip: 0,
        scoopedMl: 0,
        countedLossMl: 0,
        maxDistance: 0,
        deliveredMl: 0,
        splashedMl: 0,
        container: 0,
        noDrip: 'none',
        roseTorn: false,
        lastTrip: false
      },
      stats: {
        startedAt: now(),
        endedAt: 0,
        trips: 0,
        drains: 0,
        scoops: 0,
        deliveredMl: 0,
        lostByCause: emptyCauses(),
        drainsByCause: emptyCauses(),
        fliesBlown: 0,
        fliesSwatted: 0
      },
      lastDrain: null,
      replays: createReplayLog(),
      share: null,
      ended: false,
      lastDeliveredMl: 0,
      tripReport: '',
      hintsDone: createHintsDone(),
      drainStreak: 0,
      assistSuggested: false,
      fx: { dripMl: 0, sloshMl: 0, dribbleMl: 0, holeMl: 0 }
    }
  }

  /** Advances the simulation by one fixed step. */
  update(dtMs: number, input: InputFrame): void {
    const s = this.state
    s.timeMs += dtMs
    // The game is over: the ending screen sits on the last frame.
    if (s.ended) return
    s.blowing = false
    const switched = input.mode !== s.inputMode
    s.inputMode = input.mode
    this.stepPeak = 0
    this.finishWaits()
    // The press that brought a new input in never grabs the sieve.
    if (switched && this.switchInput()) return
    this.handleGrip(input)
    // A tap that skipped the ending's last moments ends the game on this step.
    if (s.paused || s.ended) return
    // In motion mode the phone is the sieve: you always hold it, except on the run back.
    if (
      input.mode === 'motion' &&
      !s.grip.held &&
      s.scene !== 'walkBack' &&
      s.scene !== 'cutscene'
    )
      s.grip.held = true
    if (s.holdStillMs > 0) {
      s.holdStillMs -= dtMs
      // The hand re-learns its baseline while you settle.
      this.hand.reset()
      if (s.holdStillMs <= 0) {
        s.holdStillMs = 0
        this.events.push({ type: 'resume' })
      }
      return
    }
    s.phaseMs += dtMs
    if (s.kit.swingMs > 0) s.kit.swingMs = Math.max(0, s.kit.swingMs - dtMs)
    this.listenForSteps(input, dtMs)
    switch (s.scene) {
      case 'well':
        this.updateWell(dtMs, input)
        break
      case 'path':
        this.updatePath(dtMs, input)
        break
      case 'walkBack':
        this.updateWalkBack(dtMs, input)
        break
      case 'house':
        this.updateHouse(dtMs, input)
        break
      case 'cutscene':
        if (isCutscene(s.phase) && s.phaseMs >= CUTSCENES[s.phase].ms)
          this.endCutscene()
        break
    }
    // The cat, the plughole and the rain work on the tub wherever you are.
    const current = s.containers[s.containerIndex]
    if (current) stepCatLosses(s.cat, current, s.containers[2], dtMs)
    const tub = s.containers[2]
    const rain = tub ? stepRain(s.rain, tub, dtMs) : 'none'
    if (rain !== 'none')
      this.events.push({ type: 'rain', stage: rain, gag: s.rain.gag })
  }

  /** Plays the cold open after the start tap, which starts the clock. It ends at the well. */
  startColdOpen(): void {
    this.state.stats.startedAt = this.now()
    this.startCutscene('coldOpen')
  }

  /**
   * Turns Walk for Real on or off. It only walks you while the phone is the sieve; thumbs
   * walk again the moment it's off.
   */
  setWalkForReal(on: boolean): void {
    const rw = this.state.realWalk
    if (rw.on === on) return
    rw.on = on
    resetRealWalk(rw)
    if (on) this.state.hintsDone.realWalk = true
    this.events.push({ type: 'realWalk', on })
  }

  /** Walk for Real: counts your real steps through the phone's jolt. */
  private listenForSteps(input: InputFrame, dtMs: number): void {
    const rw = this.state.realWalk
    rw.active = rw.on && input.mode === 'motion'
    if (!rw.active) return
    this.stepPeak = detectStep(rw, input.motionJolt, dtMs)
  }

  /** Plays a cutscene now. Nothing is held while it runs. */
  startCutscene(id: CutsceneId): void {
    const s = this.state
    s.scene = 'cutscene'
    s.phase = id
    s.phaseMs = 0
    s.grip.held = false
    s.grip.tipMs = 0
    s.dribbling = false
    s.walker.speed = 0
    s.house.flow = 0
    this.events.push({ type: 'scene', scene: 'cutscene' })
  }

  /** Ends the running cutscene early, from a tap. */
  skipCutscene(): void {
    if (this.state.scene === 'cutscene') this.endCutscene()
  }

  /** Walks empty to the house from the well, for house chores during waits. */
  goToHouse(): boolean {
    if (this.contextAction() !== 'goHouse') return false
    this.emptyWalk(1)
    return true
  }

  /** Leaves a house visit and walks back to the well. */
  goToWell(): boolean {
    const s = this.state
    if (s.scene !== 'house' || s.phase !== 'visit') return false
    this.emptyWalk(-1)
    return true
  }

  /** The context slot's one button right now, or null. */
  contextAction(): ContextAction | null {
    const s = this.state
    if (s.paused || s.holdStillMs > 0) return null
    // A ringing phone beats everything else.
    const event = s.event
    if (event?.id === 'ring' && event.stage === 'warning') {
      if (event.talkMs <= 0) return 'call'
      return this.interviewChoices() ? 'interview' : null
    }
    if (carry.swatReady(this)) return 'swat'
    if (s.scene === 'walkBack') {
      if (s.pratfallMs > 0 || s.wipe) return null
      const patch = patchById(s.path, s.promptPatch)
      if (!patch) {
        if (stones.stonePrompt(s)) return 'stone'
        return s.share && s.phase === 'return' ? 'share' : null
      }
      return patch.kind === 'ice'
        ? 'scrape'
        : patch.kind === 'leaves'
          ? 'sweep'
          : 'wipe'
    }
    if (s.scene === 'house') return s.phase === 'visit' ? 'goWell' : null
    const offer = this.offersRealWalk() ? 'realWalk' : null
    if (s.scene === 'path') return s.phase === 'carry' ? offer : null
    if (s.scene !== 'well' || s.bench.open) return null
    const empty = s.sieve.inSieve === 0 && !s.well.dipped
    return empty ? 'goHouse' : offer
  }

  /**
   * Last Trip on a phone holding the sieve: Walk for Real is worth filming, so the
   * context slot offers it until you turn it on.
   */
  private offersRealWalk(): boolean {
    const s = this.state
    return (
      s.inputMode === 'motion' &&
      !s.realWalk.on &&
      this.lastTripLabel() !== 'no'
    )
  }

  /** Presses the context slot's button. Share opens a dialog, so the UI handles it. */
  doContext(): void {
    const s = this.state
    const action = this.contextAction()
    if (action === 'goHouse') this.goToHouse()
    else if (action === 'goWell') this.goToWell()
    else if (action === 'swat') this.swat()
    else if (action === 'realWalk') this.setWalkForReal(true)
    else if (action === 'stone') stones.openStone(this)
    else if (action === 'wipe' || action === 'scrape' || action === 'sweep') {
      // Step onto the patch and start rubbing.
      const patch = patchById(s.path, s.promptPatch)
      if (!patch) return
      s.walker.distance = patch.at
      this.openWipe(patch)
    }
  }

  /** One or more rub strokes on the open rub area. Returns true when it's wiped away. */
  rub(strokes = 1): boolean {
    const s = this.state
    const wipe = s.wipe
    if (!wipe || s.paused) return false
    let done: number
    if (wipe.target === 'floor') {
      s.house.floorWiped += strokes
      done = s.house.floorWiped
    } else {
      const patch = patchById(s.path, wipe.patchId)
      if (!patch) {
        s.wipe = null
        return false
      }
      patch.wiped += strokes
      done = patch.wiped
    }
    this.events.push({ type: 'rub', progress: Math.min(1, done / wipe.needed) })
    if (done < wipe.needed) return false
    if (wipe.target === 'floor') {
      s.house.floorPatch = false
      s.house.floorWiped = 0
      this.chores.complete(WIPE_FLOOR_CHORE.id)
    } else {
      const patch = patchById(s.path, wipe.patchId)
      if (patch) this.chores.complete(patchChore(patch).id)
      removePatch(s.path, wipe.patchId)
      s.promptPatch = -1
    }
    s.wipe = null
    s.hintsDone.wipe = true
    this.events.push({ type: 'wiped', target: wipe.target })
    return true
  }

  /** Where your sponge is over the rub area, for drawing. */
  wipeHand(x: number, y: number, holding: boolean): void {
    const wipe = this.state.wipe
    if (!wipe) return
    wipe.handX = x
    wipe.handY = y
    wipe.holding = holding
  }

  /** The first-time hint or pause line to show now, for the input in use. */
  hint(mode: InputMode): string | null {
    // The renderer asks every frame, so the context object is reused.
    const context = this.hintContext
    // Only while the button shows: at the well, Go to House comes first.
    context.offerRealWalk = this.contextAction() === 'realWalk'
    context.atStake = this.atStake()
    context.rewaxOpen = this.chores.has(REWAX_CHORE.id)
    context.canShop = this.shopWorthIt() && this.canShop()
    return hintFor(this.state, mode, context)
  }

  /** You can afford an upgrade you don't own yet. */
  private shopWorthIt(): boolean {
    for (const upgrade of UPGRADES)
      if (!this.shop.owned(upgrade.id) && this.wallet.canAfford(upgrade.cost))
        return true
    return false
  }

  /** The HUD label for the bathtub's final stretch. */
  lastTripLabel(): 'no' | 'last' | 'really' {
    if (!this.isLastTrip()) return 'no'
    return this.state.lastTripMissed ? 'really' : 'last'
  }

  /** Crank circles that raise the well bucket now: one more in winter. */
  crankCircles(): number {
    return crankNeeded(this.state.season === 'winter')
  }

  /**
   * Dev and tests: sets a container's litres and makes it the one you fill. Earlier
   * containers count as full; the season and milestones follow the new progress.
   */
  setContainer(index: number, ml: number): void {
    if (!import.meta.env.DEV) return
    const s = this.state
    const target = s.containers[index]
    if (!target) return
    s.containers.forEach((ledger, i) => {
      const def = CONTAINERS[i]
      if (!def || i > index) return
      const fill = i < index ? def.capacityMl : Math.round(ml)
      ledger.inContainer = fill
      ledger.delivered = fill + ledger.plugDrained + ledger.catDrunk
      ledger.done = i < index
    })
    s.containerIndex = index
    s.milestonesShown = index === 2 ? milestonesPassed(target.inContainer) : 0
    s.lastTripMissed = false
    const season = seasonFor(index, s.containers[2]?.inContainer ?? 0)
    if (season !== s.season) {
      s.season = season
      this.events.push({ type: 'season', season, quiet: false })
    }
  }

  /**
   * Dev and tests: jumps to a scene. 'path' starts a trip `distance` m along, carrying a
   * full sieve, or an empty walk to the house when `full` is false. 'house' walks in with
   * a full sieve, or arrives empty for a visit. 'walkBack' runs home from `distance` m.
   * 'well' stands at the well with an empty sieve.
   */
  jumpTo(
    scene: Exclude<SceneId, 'cutscene'>,
    { distance = 0, full = scene !== 'walkBack' && scene !== 'well' } = {}
  ): void {
    if (!import.meta.env.DEV) return
    const s = this.state
    s.paused = false
    s.holdStillMs = 0
    s.bench.open = false
    s.wipe = null
    if (s.scene === 'cutscene') s.pendingCutscene = null
    const at = Math.max(0, Math.min(PATH_METRES, distance))
    if (scene === 'well') {
      this.setSieve(0)
      this.arriveAtWell()
    } else if (scene === 'walkBack') {
      this.setSieve(0)
      this.toWalkBack(at)
    } else if (!full) {
      this.setSieve(0)
      this.emptyWalk(1)
      s.walker.distance = at
      if (scene === 'house') this.arriveAtHouse()
    } else {
      this.setSieve(s.capacityMl)
      const grip = s.grip
      grip.held = true
      grip.tipMs = 0
      grip.offsetX = grip.offsetY = 0
      this.toPath()
      s.walker.distance = scene === 'house' ? PATH_METRES : at
      if (scene === 'house') this.toHouse()
    }
  }

  /** Dev and tests: jumps to a season. */
  setSeason(season: Season): void {
    if (!import.meta.env.DEV) return
    if (season === this.state.season) return
    this.state.season = season
    this.events.push({ type: 'season', season, quiet: false })
  }

  /** Tears up to `count` holes in the mesh (dev and tests). */
  addHoles(count = 1): void {
    if (!import.meta.env.DEV) return
    for (let i = 0; i < count; i++) this.tear('dev')
  }

  // ---------------------------------------------------------------- Leaves

  /** What a dip can hold now: the sieve's capacity, cut 15% by each leaf in the water. */
  fillCap(): number {
    return leafCapacity(this.state.capacityMl, this.state.well.leaves.length)
  }

  /** Drops leaves into the well water (dev and tests). */
  dropLeaves(count = 3): void {
    if (!import.meta.env.DEV) return
    this.addLeaves(count, 'dev')
  }

  /** True while leaves can be dragged out: at the well, sieve out of the water, bench shut. */
  canClearLeaves(): boolean {
    const s = this.state
    return (
      s.scene === 'well' &&
      !s.paused &&
      s.holdStillMs <= 0 &&
      !s.bench.open &&
      !s.well.dipped
    )
  }

  /** A dragged leaf left the water. The last one closes the chore. */
  removeLeaf(id: number): boolean {
    const s = this.state
    const leaves = s.well.leaves
    const index = leaves.findIndex(l => l.id === id)
    if (index < 0 || !this.canClearLeaves()) return false
    leaves.splice(index, 1)
    s.hintsDone.leaves = true
    if (leaves.length === 0) this.chores.complete(LEAVES_CHORE.id)
    this.events.push({ type: 'leafOut', left: leaves.length })
    return true
  }

  /** Where a floating leaf rests now, from the scene's physics, in the pond's unit disc. */
  placeLeaf(id: number, u: number, v: number, angle: number): void {
    const leaf = this.state.well.leaves.find(l => l.id === id)
    if (!leaf) return
    leaf.u = u
    leaf.v = v
    leaf.angle = angle
  }

  // ---------------------------------------------------------------- Carry events and calls

  /**
   * Starts a carry event (dev and tests): now if you're carrying, otherwise on your next
   * carry, 20 m out.
   */
  triggerEvent(id: CarryEventId): void {
    if (!import.meta.env.DEV) return
    carry.triggerEvent(this, id)
  }

  /** Sends a threat after you into the bathroom (dev and tests). */
  triggerBathroom(id: CarryEventId): void {
    if (!import.meta.env.DEV) return
    carry.triggerBathroom(this, id)
  }

  /** E or the Answer button: you stop and listen while the caller talks. */
  answerCall(): boolean {
    return carry.answerCall(this)
  }

  /** F or the Decline button: a small jab, and Mum calls back next trip. */
  declineCall(): boolean {
    return carry.declineCall(this)
  }

  /** Answers the interviewer's question with E (the first answer) or F (the second). */
  chooseAnswer(choice: 'e' | 'f'): boolean {
    return carry.chooseAnswer(this, choice)
  }

  /** The interviewer's question while they wait for your answer, or null. */
  interviewChoices(): { question: string; e: string; f: string } | null {
    return carry.interviewChoices(this)
  }

  /** Where a falling leaf or a fly is in the cam now, for blowing at it with a finger. */
  blowTarget(out: LeafSpot): LeafSpot | null {
    return carry.blowTarget(this, out)
  }

  /** The Swat button: swings on the next step, if you own the swatter. */
  swat(): boolean {
    if (!this.state.kit.swatter) return false
    this.state.kit.swatQueued = true
    return true
  }

  // ---------------------------------------------------------------- The house

  /** House chores need your hands free: on a house visit, with the sieve put down. */
  canTouchHouse(): boolean {
    return trouble.canTouchHouse(this)
  }

  /** A tap on the cat: it puffs up, leaps off and stops drinking. */
  shooCat(): boolean {
    return trouble.shooCat(this)
  }

  /** The pulled plug follows your pointer back toward the plughole. */
  dragPlug(x: number, y: number): void {
    trouble.dragPlug(this, x, y)
  }

  /** Drops the plug: in the hole it stops the drain, anywhere else it swings back. */
  dropPlug(x: number, y: number): boolean {
    return trouble.dropPlug(this, x, y)
  }

  /** Starts the cat drinking now, if the container is worth it (dev and tests). */
  triggerCat(): boolean {
    if (!import.meta.env.DEV) return false
    return trouble.startCat(this, true)
  }

  /** Starts the next spring rain over the tub now, in the bathtub phase (dev and tests). */
  triggerRain(): boolean {
    if (!import.meta.env.DEV) return false
    return trouble.triggerRain(this)
  }

  /** Has the cat pull the bathtub plug now, in the bathtub phase (dev and tests). */
  triggerPlug(): boolean {
    if (!import.meta.env.DEV) return false
    return trouble.pullPlug(this, true)
  }

  /** Something in the house needs you: a wet floor, the cat or the plug. */
  houseNeedsYou(): boolean {
    return trouble.houseNeedsYou(this)
  }

  // ---------------------------------------------------------------- Shop and kit

  /** True where the shop opens: an empty sieve, at the well or on a house visit. */
  canShop(): boolean {
    const s = this.state
    if (s.sieve.inSieve > 0 || s.holdStillMs > 0) return false
    if (s.scene === 'well') return !s.well.dipped && !s.bench.open
    return s.scene === 'house' && s.phase === 'visit'
  }

  /** Buys an upgrade with coins and puts it to use. `free` pays for it first (dev tools). */
  buy(id: UpgradeId, { free = false } = {}): boolean {
    const def = this.shop.get(id)
    if (import.meta.env.DEV && free && !this.shop.owned(id))
      this.wallet.earn(def.cost, 'Dev')
    if (!this.shop.buy(id).ok) return false
    this.bought(id)
    return true
  }

  /** Puts an upgrade the shop just sold to use. The shop panel buys, then calls this. */
  bought(id: UpgradeId): void {
    kit.applyUpgrade(this, id)
  }

  /** Why a joke buy can't happen now, or null. */
  jokeBlocker(id: JokeId): JokeBlocker | null {
    return kit.jokeBlocker(this, id)
  }

  /** Buys a wish, cat treats or the party hat. Returns its line for a toast, or null. */
  buyJoke(id: JokeId): string | null {
    return kit.buyJoke(this, id)
  }

  /**
   * Hangs soaked slippers on the washing line at the well. Their wait blocks nothing (you
   * go on barefoot), so the director adds no chore for it.
   */
  hangSlippers(): boolean {
    return kit.hangSlippers(this)
  }

  /** The paving stone follows your pointer while you drag it (Paved Path). */
  dragStone(x: number, y: number): void {
    stones.dragStone(this, x, y)
  }

  /** Drops the stone: in its slot it's laid. Returns true when it was. */
  dropStone(x: number, y: number): boolean {
    return stones.dropStone(this, x, y)
  }

  /** Lays the stone that's out straight into its slot (dev tools and the autopilot). */
  layStone(): boolean {
    return stones.layStone(this)
  }

  /** Rub strokes with the wax block at the open bench. Returns true once it's waxed. */
  rubWax(strokes = 1): boolean {
    if (!kit.rubWax(this, strokes)) return false
    this.closeBench()
    return true
  }

  /**
   * Resumes after a dialog closes, when nothing is at stake. With water in your hands it
   * stays paused until a fresh grip, so a closing dialog can never tip the sieve.
   */
  resume(): void {
    const s = this.state
    if (!s.paused || this.atStake()) return
    s.paused = false
    this.events.push({ type: 'resume' })
  }

  /** True while water is out of the bucket and in your hands, so letting go would spill. */
  atStake(): boolean {
    const s = this.state
    return this.exposed() || (s.phase === 'pour' && s.sieve.inSieve > 0)
  }

  /** Pauses the simulation, for example on a window blur. Any pending tip is cancelled. */
  pause(): void {
    const s = this.state
    if (s.paused) return
    s.paused = true
    s.inputSwitched = false
    s.grip.tipMs = 0
    s.grip.held = false
    // A Swat tapped as the game paused would swing out of nowhere after the resume.
    s.kit.swatQueued = false
    this.events.push({ type: 'pause' })
  }

  /** Drains the sieve now with `cause`. Used by breaks, tips, events and dev tools. */
  drain(cause: LossCause): void {
    const s = this.state
    if (s.sieve.inSieve <= 0) return
    const pouring = s.phase === 'pour'
    const ml = moveAll(s.sieve, 'drained')
    s.stats.lostByCause[cause] += ml
    s.stats.drainsByCause[cause]++
    s.stats.drains++
    this.countLoss(ml)
    s.drainStreak++
    if (
      s.drainStreak >= ASSIST_SUGGEST_DRAINS &&
      !s.assistSuggested &&
      !settings.get().assist
    ) {
      s.assistSuggested = true
      this.events.push({ type: 'suggestAssist' })
    }
    s.grip.tipMs = 0
    // Whatever was about to happen has nothing left to spill.
    if (s.event?.stage === 'warning') endEvent(s.event, 'missed')
    const house = s.scene === 'house'
    const record = {
      cause,
      ml,
      distance: this.pathDistance(),
      trip: s.trip,
      scene: s.scene,
      walkIn: house ? Math.min(HOUSE_WALK_METRES, s.walker.distance) : 0,
      pouring,
      container: s.current.container,
      capacityMl: s.capacityMl
    }
    s.lastDrain = { ...record, replay: claimReplay(s.replays, record) }
    // On the path or in the house the trip ends, all over your feet; at the well you
    // just scoop again.
    if (s.scene !== 'well') {
      this.setPhase('drained')
      kit.soakSlippers(this)
      s.share = { kind: 'fail' }
    }
    // Whatever made it into the tub before the drain still pays.
    if (pouring) {
      s.house.flow = 0
      s.house.pourValue = 0
      this.payDelivery()
    }
    if (s.scene === 'path') {
      const patch = addDrainPatch(s.path, s.walker.distance)
      this.events.push({ type: 'patch', at: patch.at })
    }
    this.events.push({
      type: 'drain',
      cause,
      ml,
      distance: s.lastDrain.distance,
      big: ml >= s.capacityMl / 2,
      scene: s.scene,
      record: s.lastDrain
    })
  }

  /** Water lost so far: everything the sieve lost, plus what the cat drank and the plug let out. */
  lostMl(): number {
    const s = this.state
    let total = 0
    for (const cause of ALL_CAUSES) total += s.stats.lostByCause[cause]
    for (const ledger of s.containers)
      total += ledger.catDrunk + ledger.plugDrained
    return total
  }

  /** Wall-clock time since the start tap, stopped once the tub is full. */
  playedMs(): number {
    const stats = this.state.stats
    return Math.max(0, (stats.endedAt || this.now()) - stats.startedAt)
  }

  /** The ending screen's numbers. */
  endingStats(): EndingStats {
    const s = this.state
    return endingStats({
      playedMs: this.playedMs(),
      trips: s.stats.trips,
      scoopedMl: s.sieve.scooped,
      lostByCause: s.stats.lostByCause,
      containers: s.containers,
      fliesBlown: s.stats.fliesBlown,
      coins: this.wallet.coins(),
      answer: s.calls.answer,
      asked: s.calls.questions > 0
    })
  }

  /** Sets the water in the sieve, scooping or draining as needed (dev and tests). */
  setSieve(ml: number): void {
    if (!import.meta.env.DEV) return
    const s = this.state
    const target = Math.max(0, Math.round(ml))
    if (target > s.sieve.inSieve) addWater(s.sieve, target - s.sieve.inSieve)
    else if (target < s.sieve.inSieve)
      leak(s.sieve, 'dripped', s.sieve.inSieve - target)
  }

  /** True when the water ledger balances exactly. */
  balanced(): boolean {
    return isBalanced(this.state.sieve)
  }

  /** The container you're filling now. */
  container(): { def: (typeof CONTAINERS)[number]; ledger: ContainerLedger } {
    const s = this.state
    const def = CONTAINERS[s.containerIndex] ?? CONTAINERS[0]
    const ledger = s.containers[s.containerIndex] ?? s.containers[0]
    if (!def || !ledger)
      throw new Error(
        'Sim: the container list is empty, so nothing can be filled'
      )
    return { def, ledger }
  }

  /** Ends every running wait now (dev tools). */
  finishWaitsNow(): void {
    if (!import.meta.env.DEV) return
    const { refill, glue, slippers } = this.state.waits
    if (refill) refill.endsAt = this.now()
    if (glue) glue.endsAt = this.now()
    if (slippers) slippers.endsAt = this.now()
    this.finishWaits()
  }

  /** Why the sieve can't scoop now, or null. */
  scoopBlocker(): string | null {
    const s = this.state
    if (s.holes.some(h => !isSewn(h))) return 'Mend the holes first.'
    if (s.holes.length > 0) return 'Glue the stitches first.'
    if (s.waits.glue) return 'The glue is still drying.'
    return null
  }

  // ---------------------------------------------------------------- Workbench

  /**
   * Opens the workbench at the well with the sieve empty: to mend holes, or to rub the wax
   * back on. Returns false, with a reason on screen, when it can't open.
   */
  openBench(mode: 'mend' | 'wax' = 'mend'): boolean {
    const s = this.state
    if (s.scene !== 'well' || s.paused || s.bench.open) return false
    const blocker =
      mode === 'mend'
        ? s.holes.length === 0
          ? 'Nothing to mend.'
          : null
        : !this.chores.has(REWAX_CHORE.id)
          ? 'The wax is fine for now.'
          : s.holes.length > 0
            ? 'Mend the holes first.'
            : null
    if (blocker || s.sieve.inSieve > 0 || s.well.dipped) {
      const message = blocker ?? 'Empty the sieve first.'
      this.events.push({ type: 'blocked', message })
      return false
    }
    s.bench.open = true
    s.bench.mode = mode
    s.bench.holding = false
    s.grip.held = false
    s.grip.tipMs = 0
    if (mode === 'mend') s.hintsDone.hole = true
    this.setPhase('bench')
    this.events.push({ type: 'bench', open: true, holes: s.holes.length, mode })
    return true
  }

  /** Leaves the workbench; stitches made so far stay. */
  closeBench(): void {
    const s = this.state
    if (!s.bench.open) return
    s.bench.open = false
    s.bench.holding = false
    this.setPhase(this.wellPhase())
    this.events.push({
      type: 'bench',
      open: false,
      holes: s.holes.length,
      mode: s.bench.mode
    })
  }

  /** The needle's eye x right now, for hit tests and drawing. */
  eyeX(): number {
    const bench = this.state.bench
    return eyeX(bench.swayS, bench.shake)
  }

  /**
   * Where your pointer holds the thread or needle, and how fast it moves. Fast, jerky
   * drags shake the needle, so its eye swings further.
   */
  benchHand(x: number, y: number, holding: boolean, speed = 0): void {
    const bench = this.state.bench
    bench.handX = x
    bench.handY = y
    bench.holding = holding
    bench.shake = Math.max(bench.shake, Math.min(1, speed / EYE_SHAKE_SPEED))
  }

  /** Lets go of the thread at the eye: `hit` threads the needle, a miss starts over. */
  threadNeedle(hit: boolean): void {
    const s = this.state
    const bench = s.bench
    if (!bench.open || bench.threaded) return
    bench.holding = false
    if (hit) {
      bench.threaded = true
      s.hintsDone.thread = true
    }
    this.events.push({ type: 'thread', hit })
  }

  /** The needle passed through stitch point `index` of hole `holeId`. */
  stitch(holeId: number, index: number): 'stitch' | 'unpick' | 'none' {
    const s = this.state
    if (benchStage(s.bench, s.holes) !== 'sew' || !s.bench.open) return 'none'
    const hole = s.holes.find(h => h.id === holeId && !isSewn(h))
    if (!hole || hole !== s.holes.find(h => !isSewn(h))) return 'none'
    const result = sewPoint(hole, index)
    if (result === 'none') return result
    const sewn = isSewn(hole)
    if (sewn) s.hintsDone.sew = true
    this.events.push({ type: 'stitch', result, sewn })
    return result
  }

  /** Glues every sewn hole: the mesh is whole again once the glue dries. */
  applyGlue(): boolean {
    const s = this.state
    if (!s.bench.open || benchStage(s.bench, s.holes) !== 'glue') return false
    if (s.holes.length === 0) return false
    s.holes.length = 0
    s.bench.threaded = false
    this.chores.complete(MEND_CHORE.id)
    s.waits.glue = startTimer('Glue drying', GLUE_MS, this.now())
    this.events.push({ type: 'glue' })
    this.direct('glueStart', timeLeftMs(s.waits.glue, this.now()) / 1000)
    // Rewax while the glue dries, if the wax wants it; otherwise back to the well.
    if (this.chores.has(REWAX_CHORE.id)) {
      s.bench.mode = 'wax'
      s.bench.holding = false
      this.events.push({ type: 'bench', open: true, holes: 0, mode: 'wax' })
    } else this.closeBench()
    return true
  }

  // ---------------------------------------------------------------- Gesture commands

  /** Whether the crank can turn now, or why not. */
  crankBlocker(): string | null {
    const s = this.state
    if (s.scene !== 'well' || s.well.bucketUp) return ''
    if (s.waits.refill) return 'The well is refilling.'
    if (s.well.frog !== 'none') return 'Move the frog first.'
    return null
  }

  /** One full crank circle, from the crank gesture or the autopilot. */
  crankCircle(direction: 1 | -1, durationMs: number): CrankResult | null {
    const s = this.state
    const blocker = this.crankBlocker()
    if (blocker !== null) {
      if (blocker) this.events.push({ type: 'blocked', message: blocker })
      return null
    }
    const result = crankCircle(
      s.well,
      direction,
      durationMs,
      this.crankCircles()
    )
    this.events.push({ type: 'crank', result, turns: s.well.crankTurns })
    if (result === 'up') s.hintsDone.crank = true
    // Autumn leaves blew into the well; up they come with the bucket.
    if (result === 'up' && s.season === 'autumn')
      this.addLeaves(crankLeaves(this.random), 'crank')
    return result
  }

  /** The crank pointer let go. Mid-crank, the bucket spins back down. */
  crankLetGo(): void {
    if (this.state.scene !== 'well') return
    if (crankLetGo(this.state.well)) this.events.push({ type: 'crankSpin' })
  }

  /** Progress through the current circle (0 to 1) and the handle angle, for drawing. */
  setCrank(progress: number, angle: number): void {
    const well = this.state.well
    if (this.crankBlocker() !== null) return
    well.crankProgress = Math.max(0, Math.min(1, progress))
    well.crankAngle = angle
  }

  /** Drags the frog to (x, y). */
  dragFrog(x: number, y: number): void {
    const well = this.state.well
    if (well.frog === 'none') return
    well.frog = 'dragging'
    well.frogX = x
    well.frogY = y
  }

  /** Drops the frog. Far enough from the crank, it's off; the first time, it hops back. */
  dropFrog(x: number, y: number): void {
    const s = this.state
    const well = s.well
    if (well.frog === 'none') return
    const handle = crankHandle(well.crankAngle)
    const far = Math.hypot(x - handle.x, y - handle.y) >= FROG_DROP_DISTANCE
    well.frog = 'on'
    if (!far) return
    well.frogMoves++
    if (well.frogMoves === 1) {
      this.events.push({ type: 'frogBack' })
      return
    }
    well.frog = 'none'
    this.chores.complete(FROG_CHORE.id)
    s.hintsDone.frog = true
    this.events.push({ type: 'frogGone' })
  }

  // ---------------------------------------------------------------- Grip

  private setPhase(phase: Phase): void {
    if (this.state.phase === phase) return
    this.state.phase = phase
    this.state.phaseMs = 0
  }

  /** True when letting go now would spill: water in the sieve, out of the bucket. */
  private exposed(): boolean {
    const s = this.state
    if (s.sieve.inSieve <= 0) return false
    if (s.scene === 'well') return !s.well.dipped
    return s.phase === 'carry' || s.phase === 'enter'
  }

  /** Metres along the path, counting the house as the end of it. */
  private pathDistance(): number {
    const s = this.state
    if (s.scene === 'house') return PATH_METRES
    return s.scene === 'path' ? s.walker.distance : 0
  }

  /** Records a loss you caused; the first one cracks the No-Drip badge. */
  private countLoss(ml: number): void {
    const current = this.state.current
    if (!(ml > 0)) return
    current.countedLossMl += ml
    if (current.noDrip !== 'intact') return
    current.noDrip = 'cracked'
    this.events.push({ type: 'noDripCracked' })
  }

  /**
   * Another input took over, such as a mouse brushing a tablet you tilt. Its pointer says
   * nothing about where the sieve is, so with water at stake the game pauses until a
   * fresh grip anchors the new input. Otherwise the new input picks the sieve up afresh.
   * Returns true when it paused.
   */
  private switchInput(): boolean {
    const s = this.state
    if (s.paused) return false
    if (!this.atStake()) {
      s.grip.held = false
      return false
    }
    this.pause()
    s.inputSwitched = true
    this.events.push({ type: 'inputSwitched', mode: s.inputMode })
    return true
  }

  /** Applies grip presses and classified releases from the input frame. */
  private handleGrip(input: InputFrame): void {
    const s = this.state
    const grip = s.grip
    if (input.release === 'pause') {
      this.pause()
    } else if (input.release === 'letGo' && grip.held) {
      grip.held = false
      // Letting go mid-pour dumps the lot; anywhere else you get a moment to catch it.
      if (s.phase === 'pour') this.dump()
      else if (this.exposed()) grip.tipMs = REGRAB_WINDOW_MS
    }
    if (!input.gripPressed) {
      // A button still held through the walk back picks the empty sieve up again at the
      // well, so you can scoop without letting go and pressing again.
      if (
        input.grip &&
        input.mode !== 'motion' &&
        !grip.held &&
        !s.paused &&
        s.scene === 'well' &&
        !s.bench.open &&
        s.sieve.inSieve === 0
      )
        this.grab(input)
      return
    }
    if (s.paused) {
      s.paused = false
      // With water at stake, settle for a moment before the world moves again.
      if (this.atStake()) {
        s.holdStillMs = HOLD_STILL_MS
        this.grab(input)
        return
      }
      this.events.push({ type: 'resume' })
    } else if (s.scene === 'cutscene') {
      if (s.phaseMs >= SKIP_GUARD_MS) this.endCutscene()
      return
    }
    // Nothing to hold on the walk back, in a cutscene or at the bench.
    if (s.scene === 'walkBack' || s.scene === 'cutscene') return
    if (s.bench.open) return
    if (grip.tipMs > 0) {
      grip.tipMs = 0
      this.body.pulse(REGRAB_PULSE, REGRAB_PULSE_MS, 'letGo')
      this.grab(input)
      this.events.push({ type: 'catch' })
    } else if (!grip.held) {
      this.grab(input)
      this.events.push({ type: 'grip' })
    }
  }

  /** Takes hold at the input position, keeping the sieve where it was. */
  private grab(input: InputFrame): void {
    const s = this.state
    const grip = s.grip
    grip.held = true
    grip.x = input.x
    grip.y = input.y
    if (s.scene === 'well') {
      grip.anchorX = input.x - grip.offsetX
      grip.anchorY = input.y - (s.well.sieveY - SIEVE_HOVER_Y)
      return
    }
    grip.anchorX = input.x + s.drift.x - grip.offsetX
    grip.anchorY = input.y + s.drift.y - grip.offsetY
    // Mid-pour, re-anchor the pour axis so the flow carries on where it was.
    if (s.phase === 'pour')
      s.house.pourAnchorX = input.x - pointerPourOffset(s.house.pourValue)
  }

  /** `motionScale` softens the phone's jolt, for footsteps while you walk for real. */
  private feedHand(input: InputFrame, dtMs: number, motionScale = 1): void {
    const s = this.state
    if (s.grip.held && input.mode === 'motion')
      this.hand.feedMotion(input.motionJolt * motionScale, dtMs)
    else if (s.grip.held) this.hand.feed(input.handAccel / POINTER_REF, dtMs)
    else this.hand.feed(0, dtMs)
    s.steady.hand = this.hand.level
  }

  /** Steps the body level and computes the total and zone. */
  private updateLevels(gaitRaw: number, dtMs: number): void {
    const s = this.state
    this.body.step(gaitRaw, dtMs, settings.get().assist)
    s.steady.body = this.body.level
    s.steady.total = totalLevel(
      s.steady.hand,
      s.steady.body,
      sieveWeight(s.gear)
    )
    s.steady.zone = zoneOf(s.steady.total)
  }

  /**
   * Base drip, slosh and tilt dribble while the sieve is exposed, then the break and tip
   * checks and the let-go timer. Returns true when the sieve drained.
   */
  private applyLosses(dtMs: number): boolean {
    const s = this.state
    const assist = settings.get().assist
    const water = s.sieve.inSieve
    const dt = dtMs / 1000
    this.drip(baseDripRate(water, s.gear) * dt)
    const slosh = sloshRate(water, s.steady.total, s.gear) * dt
    const dribble = dribbleRate(water, s.tiltDeg, assist) * dt
    s.dribbling = dribble > 0
    this.countLoss(slosh + dribble)
    const sloshed = leak(s.sieve, 'dripped', slosh)
    const dribbled = leak(s.sieve, 'dripped', dribble)
    s.fx.sloshMl += sloshed
    s.fx.dribbleMl += dribbled
    s.stats.lostByCause.drip += sloshed + dribbled
    this.leakHoles(dt)
    const grip = s.grip
    if (grip.tipMs > 0) {
      grip.tipMs -= dtMs
      if (grip.tipMs <= 0) {
        this.drain('letGo')
        return true
      }
    }
    if (s.sieve.inSieve <= 0) return false
    if (s.steady.total >= BREAK_LEVEL) {
      this.drain(this.body.largestCause() ?? 'jolt')
      return true
    }
    if (s.tiltDeg >= tiltLimits(assist).tip) {
      this.drain('tilt')
      return true
    }
    return false
  }

  /** Base drip: never counts against No-Drip. */
  private drip(ml: number): void {
    const s = this.state
    const moved = leak(s.sieve, 'dripped', ml)
    s.fx.dripMl += moved
    s.stats.lostByCause.drip += moved
  }

  /** Water through torn holes: a loss you caused, so it cracks No-Drip. */
  private leakHoles(dt: number): void {
    const s = this.state
    const open = this.openHoles()
    if (open === 0) return
    const ml = holeLeakRate(open) * dt
    this.countLoss(ml)
    const moved = leak(s.sieve, 'dripped', ml)
    s.fx.holeMl += moved
    s.stats.lostByCause.drip += moved
  }

  /** Holes not sewn yet. */
  private openHoles(): number {
    let open = 0
    for (const hole of this.state.holes) if (!isSewn(hole)) open++
    return open
  }

  /** Tears a hole in the mesh, if there's room for one. Mending it becomes a chore. */
  private tear(cause: 'rose' | 'ice' | 'dev'): void {
    const s = this.state
    if (!tearHole(s.holes, this.random, s.nextHoleId)) return
    s.nextHoleId++
    this.chores.add(MEND_CHORE)
    this.events.push({ type: 'hole', cause })
  }

  /** Leaves land in the well water, and the chore to clear them opens. */
  private addLeaves(count: number, cause: 'crank' | 'wind' | 'dev'): void {
    const well = this.state.well
    const added = scatterLeaves(
      well.leaves,
      count,
      this.random,
      well.nextLeafId
    )
    if (added === 0) return
    well.nextLeafId += added
    this.chores.add(LEAVES_CHORE)
    this.events.push({ type: 'leavesIn', count: added, cause })
  }

  /**
   * The chore director: when a wait starts, or you arrive with one running, it opens
   * chores until they cover enough of the wait. Only chores built so far can open.
   */
  private direct(moment: DirectorMoment, waitLeftS: number): void {
    const s = this.state
    // The cat only drinks from a container worth it, and not while treats keep it busy;
    // the plug only exists in the tub; rewax only once it's nearly due.
    const available = new Set(AVAILABLE_CHORES)
    const { ledger } = this.container()
    if (!catWants(ledger) || trouble.catBusy(this)) available.delete('cat')
    if (s.containerIndex !== 2 || ledger.done || trouble.catBusy(this))
      available.delete('plug')
    if (!kit.rewaxDue(this)) available.delete('rewax')
    // A refill's house chore is now and then the cat, otherwise a wet floor.
    const houseMoment = moment === 'refillStart' || moment === 'houseArrive'
    const picks = directorPicks(moment, this.chores, waitLeftS, {
      season: s.season,
      available,
      catFirst: houseMoment && this.random() < DIRECTOR_CAT_SHARE
    })
    for (const kind of picks) {
      if (kind === 'frog') this.openFrog()
      else if (kind === 'cat') trouble.startCat(this)
      else if (kind === 'plug') trouble.pullPlug(this)
      else if (kind === 'rewax') this.chores.add(REWAX_CHORE)
      else if (kind === 'wipe' && !s.house.floorPatch) this.wetFloor()
      else if (kind === 'leaves')
        this.addLeaves(2 + Math.floor(this.random() * 2), 'wind')
    }
  }

  /** Seconds left on a wait, or 0. */
  private waitLeftS(timer: RealTimer | null): number {
    return timer ? timeLeftMs(timer, this.now()) / 1000 : 0
  }

  // ---------------------------------------------------------------- Well

  private wellPhase(): Phase {
    const s = this.state
    const well = s.well
    if (s.bench.open) return 'bench'
    if (well.bucketUp && well.scoopsLeft > 0) return 'scoop'
    return s.waits.refill || well.frog !== 'none' ? 'idle' : 'crank'
  }

  private updateWell(dtMs: number, input: InputFrame): void {
    const s = this.state
    const well = s.well
    const grip = s.grip
    this.setPhase(this.wellPhase())
    if (s.bench.open) return this.updateBench(dtMs)
    if (grip.held && input.mode === 'motion') {
      this.motionWell(input, dtMs)
    } else if (grip.held) {
      grip.x = input.x
      grip.y = input.y
      grip.offsetX = input.x - grip.anchorX
      grip.offsetY = 0
      well.sieveY = Math.max(
        LIFT_Y - 30,
        Math.min(SIEVE_DEEPEST_Y, SIEVE_HOVER_Y + (input.y - grip.anchorY))
      )
    }
    s.tiltDeg =
      input.mode === 'motion'
        ? Math.hypot(input.tiltX, input.tiltY)
        : offsetDegrees(grip.offsetX, 0)

    const capacity = s.capacityMl
    const canDip = well.bucketUp && well.scoopsLeft > 0
    const blocker = canDip ? this.scoopBlocker() : null
    const atWater = canDip && well.sieveY >= waterLineY(well.scoopsLeft)
    if (blocker && atWater) {
      // Holes or wet glue: the sieve stops at the water and tells you why, once per try.
      well.sieveY = waterLineY(well.scoopsLeft) - 1
      if (!well.blockedShown) {
        well.blockedShown = true
        this.events.push({ type: 'blocked', message: blocker })
      }
    } else if (well.sieveY < waterLineY(well.scoopsLeft) - 30) {
      well.blockedShown = false
    }
    const dipped = atWater && !blocker
    if (dipped) {
      const tau = s.gear.finerMesh ? FILL_TAU_FINE_S : FILL_TAU_S
      // Leaves in the water cling to the mesh, so the sieve fills less.
      const cap = this.fillCap()
      const gain = (cap - s.sieve.inSieve) * (1 - Math.exp(-dtMs / 1000 / tau))
      well.dipGainMl += addWater(s.sieve, gain, cap)
      if (!well.dipped) {
        this.events.push({ type: 'dip' })
        if (well.leaves.length > 0)
          this.events.push({ type: 'clogged', leaves: well.leaves.length })
      }
    } else if (well.dipped) {
      if (well.dipGainMl >= MIN_SCOOP_FRACTION * capacity) this.takeScoop()
      well.dipGainMl = 0
    }
    well.dipped = dipped

    this.feedHand(input, dtMs)
    this.updateLevels(0, dtMs)
    if (!dipped && s.sieve.inSieve > 0) {
      if (this.applyLosses(dtMs)) return
      const enough = s.sieve.inSieve >= MIN_CARRY_FRACTION * capacity
      if (grip.held && well.sieveY <= LIFT_Y && enough) this.toPath()
    } else {
      s.dribbling = false
      grip.tipMs = 0
    }
    // An empty sieve you let go of goes back on its hook.
    if (!grip.held && !dipped && s.sieve.inSieve === 0) {
      well.sieveY = SIEVE_HOVER_Y
      grip.offsetX = 0
    }
  }

  /**
   * Motion mode at the well: tip the phone forward past 25° and the sieve sinks into the
   * bucket; tip back under 8° and it rises slowly, onto the path once it holds enough.
   */
  private motionWell(input: InputFrame, dtMs: number): void {
    const s = this.state
    const well = s.well
    s.grip.offsetX = input.tiltX / DEGREES_PER_UNIT
    s.grip.offsetY = 0
    if (input.tiltY <= -MOTION_DIP_DEGREES) well.tipDip = true
    else if (input.tiltY >= -MOTION_LIFT_DEGREES) well.tipDip = false
    const canDip = well.bucketUp && well.scoopsLeft > 0
    if (canDip && well.tipDip && this.scoopBlocker() && !well.blockedShown) {
      well.blockedShown = true
      this.events.push({ type: 'blocked', message: this.scoopBlocker() ?? '' })
    }
    if (!well.tipDip) well.blockedShown = false
    const enough = s.sieve.inSieve >= MIN_CARRY_FRACTION * s.capacityMl
    const target =
      well.tipDip && canDip && !this.scoopBlocker()
        ? SIEVE_DEEPEST_Y - 5
        : enough
          ? LIFT_Y - 10
          : SIEVE_HOVER_Y
    const rate = target > well.sieveY ? MOTION_DIP_SPEED : MOTION_LIFT_SPEED
    const step = (rate * dtMs) / 1000
    well.sieveY =
      target > well.sieveY
        ? Math.min(target, well.sieveY + step)
        : Math.max(target, well.sieveY - step)
  }

  /** A dip that gained enough water counts against the well. The last one starts a refill. */
  private takeScoop(): void {
    const s = this.state
    const well = s.well
    well.scoopsLeft--
    s.stats.scoops++
    this.events.push({ type: 'scoop', left: well.scoopsLeft })
    if (well.scoopsLeft > 0) return
    well.bucketUp = false
    s.waits.refill = startTimer('Well refilling', REFILL_MS, this.now())
    this.events.push({ type: 'refill' })
    // Every wait overlaps a chore.
    this.direct('refillStart', this.waitLeftS(s.waits.refill))
  }

  /** The bench sways the needle's eye; shaky hands settle over a second or so. */
  private updateBench(dtMs: number): void {
    const s = this.state
    const bench = s.bench
    const dt = dtMs / 1000
    bench.swayS += dt
    bench.shake = Math.max(0, bench.shake - dt * 0.8)
    s.grip.held = false
    this.hand.feed(0, dtMs)
    s.steady.hand = this.hand.level
    this.updateLevels(0, dtMs)
  }

  private openFrog(): void {
    const well = this.state.well
    if (well.frog !== 'none') return
    well.frog = 'on'
    well.frogMoves = 0
    this.chores.add(FROG_CHORE)
    this.events.push({ type: 'frog' })
  }

  private finishWaits(): void {
    const s = this.state
    if (s.waits.refill && isDone(s.waits.refill, this.now())) {
      s.waits.refill = null
      s.hintsDone.refill = true
      this.events.push({ type: 'refillDone' })
    }
    if (s.waits.glue && isDone(s.waits.glue, this.now())) {
      s.waits.glue = null
      s.hintsDone.glue = true
      this.events.push({ type: 'glueDone' })
    }
    if (s.waits.slippers && isDone(s.waits.slippers, this.now())) {
      s.waits.slippers = null
      s.kit.slippers = 'dry'
      this.events.push({ type: 'slippersDry' })
    }
  }

  // ---------------------------------------------------------------- Path

  /** The lift out of the well starts a trip: the grip carries straight onto the path. */
  private toPath(): void {
    const s = this.state
    const grip = s.grip
    s.trip++
    s.stats.trips = s.trip
    s.share = null
    s.scene = 'path'
    this.setPhase('carry')
    s.walker = createWalker(0, 1)
    resetRealWalk(s.realWalk)
    s.drift = createDrift(this.random)
    s.carryMs = 0
    s.nudgeMs = 0
    this.fatigueCaptioned = false
    s.hintsDone.scoop = true
    kit.useWax(this)
    // Bumps reshuffle per container and per season; patches age and dry.
    const count = BUMPS_PER_CONTAINER[s.containerIndex] ?? 2
    const seed = 1000 + s.containerIndex * 100 + seasonIndex(s.season) * 10
    layBumps(s.path, s.trip, count, seed)
    this.agePath()
    s.path.rose = s.containerIndex >= ROSE_CONTAINER
    // The vertical lift isn't tilt; keep the sideways offset continuous through the pan.
    grip.offsetY = 0
    grip.anchorX = grip.x + s.drift.x - grip.offsetX
    grip.anchorY = grip.y + s.drift.y - grip.offsetY
    s.current = {
      trip: s.trip,
      scoopedMl: s.sieve.inSieve,
      countedLossMl: 0,
      maxDistance: 0,
      deliveredMl: 0,
      splashedMl: 0,
      container: s.containerIndex,
      noDrip: startingNoDrip(s.sieve.inSieve, s.capacityMl),
      roseTorn: false,
      lastTrip: this.isLastTrip()
    }
    // The trip's one carry event, rolled now. A dev trigger waiting in the queue wins,
    // then a caller ringing back.
    const callback =
      s.calls.callback && !s.current.lastTrip
        ? createEvent(
            'ring',
            EVENT_FROM_M + this.random() * (EVENT_TO_M - EVENT_FROM_M),
            this.random
          )
        : null
    // Last Trip saves its trouble for the bathroom.
    s.event =
      s.queuedEvent ??
      (s.current.lastTrip
        ? null
        : (callback ??
          rollCarryEvent(
            {
              trip: s.trip,
              season: s.season,
              available: AVAILABLE_EVENTS,
              lastTrip: s.eventTrips
            },
            this.random
          )))
    s.queuedEvent = null
    if (s.event?.id === 'ring' && !s.event.caller)
      s.event.caller = nextCaller(s.calls)
    if (s.event) s.eventTrips[s.event.id] = s.trip
    // House trouble rolls on its own while you're away.
    trouble.rollHouseTrouble(this)
    this.events.push({ type: 'scene', scene: 'path' })
    if (s.current.lastTrip)
      this.events.push({ type: 'lastTrip', really: s.lastTripMissed })
    else if (startsYearTwo(s.trip)) this.events.push({ type: 'yearTwo' })
  }

  /** True when the bathtub's remaining litres fit in one sieve. */
  private isLastTrip(): boolean {
    const s = this.state
    const tub = s.containers[2]
    const def = CONTAINERS[2]
    if (s.containerIndex !== 2 || !tub || !def || tub.done) return false
    return def.capacityMl - tub.inContainer <= s.capacityMl
  }

  private updatePath(dtMs: number, input: InputFrame): void {
    const s = this.state
    if (s.phase === 'drained') {
      this.settle(dtMs, CARRY_WALK.decel)
      if (s.phaseMs >= RESULT_MS) this.toWalkBack()
      return
    }
    const from = s.walker.distance
    if (carry.advanceEvent(this, dtMs, input)) return
    if (this.carryStep(dtMs, input, CARRY_WALK)) return
    if (this.pathHazards(from)) return
    // A wet house floor gets a shout before you reach the door.
    const near = from < FLOOR_WARN_M && s.walker.distance >= FLOOR_WARN_M
    if (near && s.house.floorPatch) this.events.push({ type: 'floorWarn' })
    if (s.sieve.inSieve <= 0) return this.runDry()
    if (s.walker.distance > 5) s.hintsDone.walk = true
    if (s.realWalk.active && s.walker.distance > 10)
      s.hintsDone.realSteps = true
    if (s.sieve.inSieve > 0 && s.walker.distance >= PATH_METRES) this.toHouse()
  }

  /**
   * One step of carrying water: walking, drift, steadiness and losses. Shared by the path
   * and the house walk-in. Returns true when the sieve drained.
   */
  private carryStep(
    dtMs: number,
    input: InputFrame,
    mode: typeof CARRY_WALK
  ): boolean {
    const s = this.state
    const grip = s.grip
    const walker = s.walker
    // On the phone you stand still and listen.
    const talking = s.event?.stage === 'warning' && s.event.talkMs > 0
    const real = s.realWalk.active
    if (real) {
      // Walking for real, your steps walk you and thumbs don't.
      if (talking || !grip.held) s.realWalk.owedM = 0
      stepRealWalker(walker, s.realWalk, mode, dtMs)
    } else if (
      stepWalker(walker, input.walk && grip.held && !talking, mode, dtMs)
    )
      this.events.push({ type: 'footstep', speed: walker.speed })
    s.current.maxDistance = Math.max(s.current.maxDistance, this.pathDistance())

    if (s.sieve.inSieve > 0) s.carryMs += dtMs
    // Your real hands drift on a phone; the game adds its own drift only for pointers.
    const motion = input.mode === 'motion'
    const driftScale = s.trip === 1 || motion ? 0 : 1
    stepDrift(s.drift, dtMs, walker.speed, s.carryMs / 1000, driftScale)
    // A bump nudges the sieve down for a moment; phones feel the real bump instead.
    let nudge = 0
    if (s.nudgeMs > 0) {
      s.nudgeMs = Math.max(0, s.nudgeMs - dtMs)
      if (input.mode !== 'motion')
        nudge =
          BUMP_NUDGE_UNITS * Math.sin(Math.PI * (1 - s.nudgeMs / BUMP_NUDGE_MS))
    }
    if (grip.held && motion) {
      // The water slides to the low side: the sieve shows off-centre the way you tilt.
      grip.offsetX = input.tiltX / DEGREES_PER_UNIT
      grip.offsetY = input.tiltY / DEGREES_PER_UNIT
    } else if (grip.held) {
      grip.x = input.x
      grip.y = input.y
      grip.offsetX = input.x - grip.anchorX + s.drift.x
      grip.offsetY = input.y - grip.anchorY + s.drift.y + nudge
    }
    s.tiltDeg = offsetDegrees(grip.offsetX, grip.offsetY)
    if (!this.fatigueCaptioned && s.carryMs >= FATIGUE_CAPTION_S * 1000) {
      this.fatigueCaptioned = true
      this.events.push({ type: 'fatigue' })
    }

    // Steadiness: hands through the shared meter, the body in game units.
    this.feedHand(input, dtMs, real ? REAL_HAND_SCALE : 1)
    const bob = 1 + STEP_BOB * Math.cos(Math.PI * 2 * stridePhase(walker))
    // Blowing at something shakes the sieve for as long as you blow. During a call F
    // declines instead.
    const ringing = s.event?.id === 'ring' && s.event.stage === 'warning'
    s.blowing = input.blow && !ringing
    const blow = s.blowing ? BLOW_PULSE : 0
    // Slippers soften every step, and so does a laid stone underfoot.
    const paved = s.scene === 'path' && pavedAt(s.path, walker.distance)
    const feet = gaitScale(s.kit.slippers) * (paved ? PAVED_GAIT : 1)
    // Walking for real, the phone feels your gait itself; each step pulses instead.
    const steps = real ? this.realStep(feet) : gait(walker.speed) * feet * bob
    this.updateLevels(steps + blow, dtMs)
    return this.applyLosses(dtMs)
  }

  /**
   * A real step that landed this update pulses the body: gently for a soft step, enough
   * to break for a stomp. Slippers and paving soften it like they soften the gait.
   */
  private realStep(feet: number): number {
    const peak = this.stepPeak
    if (peak <= 0) return 0
    const pulse = stepPulse(peak) * feet
    this.body.pulse(pulse, REAL_STEP_PULSE_MS, 'stomp')
    const speed = this.state.walker.speed
    this.events.push({ type: 'footstep', speed })
    this.events.push({
      type: 'realStep',
      peak,
      stomp: pulse >= BREAK_LEVEL
    })
    return 0
  }

  /**
   * Bumps you cross and patches you slip on while carrying. Returns true when a slip
   * drained the sieve.
   */
  private pathHazards(from: number): boolean {
    const s = this.state
    const walker = s.walker
    const index = bumpCrossed(s.path, from, walker.distance)
    if (index >= 0) {
      this.body.pulse(bumpAmplitude(walker.speed), BUMP_PULSE_MS, 'bump')
      s.nudgeMs = BUMP_NUDGE_MS
      const mole = s.path.moles[index] ?? false
      s.path.moles[index] = false
      s.hintsDone.bump = true
      this.events.push({ type: 'bump', index, mole, speed: walker.speed })
    }
    this.passRose(from)
    this.passPatches(from)
    const patch = patchAt(s.path, walker.distance)
    const assist = settings.get().assist
    const limit = patch ? slipSpeed(patch.kind, assist, s.kit.slippers) : 0
    if (!patch || walker.speed <= limit) return false
    // A slip throws the water: drain it with the patch as the cause.
    this.body.pulse(
      SLIP_PULSE,
      SLIP_PULSE_MS,
      patch.kind === 'ice' ? 'ice' : 'wetFloor'
    )
    this.events.push({ type: 'slip', kind: patch.kind, carrying: true })
    walker.speed = 0
    // Ice is hard: the sieve hits it and the mesh tears.
    if (patch.kind === 'ice') this.tear('ice')
    this.drain(
      patch.kind === 'ice'
        ? 'ice'
        : patch.kind === 'leaves'
          ? 'leaves'
          : 'wetFloor'
    )
    return true
  }

  /** Holes leaked the sieve dry mid-carry: the trip ends there, with nothing left to spill. */
  private runDry(): void {
    this.state.grip.tipMs = 0
    this.setPhase('drained')
    this.events.push({ type: 'dry' })
  }

  /** Thorns snag the mesh when you rush past the rose bush; once per trip. */
  private passRose(from: number): void {
    const s = this.state
    const walker = s.walker
    if (
      !s.current.roseTorn &&
      walker.speed > ROSE_SAFE_SPEED &&
      inRose(s.path, walker.distance)
    ) {
      s.current.roseTorn = true
      this.tear('rose')
    }
    if (s.path.rose && from <= ROSE_TO_M && walker.distance > ROSE_TO_M)
      s.hintsDone.rose = true
  }

  /** Marks the wet-patch hint done once you've walked past a patch. */
  private passPatches(from: number): void {
    const s = this.state
    const to = s.walker.distance
    if (!s.hintsDone.ice && s.phase === 'carry')
      for (const p of s.path.patches)
        if (p.kind === 'ice' && p.at > from && p.at <= to)
          s.hintsDone.ice = true
    if (s.hintsDone.wet || s.path.patches.length === 0) return
    const dir = s.walker.dir
    if (
      nextPatchAhead(s.path, from, dir) <= WARN_AHEAD_M &&
      nextPatchAhead(s.path, s.walker.distance, dir) > WARN_AHEAD_M
    )
      s.hintsDone.wet = true
  }

  /** Levels fall back and the walker slows while nothing is held. */
  private settle(dtMs: number, decel: number): void {
    const s = this.state
    this.hand.feed(0, dtMs)
    s.steady.hand = this.hand.level
    this.updateLevels(0, dtMs)
    s.walker.speed = Math.max(0, s.walker.speed - decel * (dtMs / 1000))
  }

  // ---------------------------------------------------------------- House

  /** The path's end: walk the last few metres to the container, still carrying. */
  private toHouse(): void {
    const s = this.state
    const speed = s.walker.speed
    s.scene = 'house'
    this.setPhase('enter')
    s.walker = createWalker(0, 1)
    s.walker.speed = Math.min(speed, HOUSE_WALK.top)
    this.events.push({ type: 'scene', scene: 'house' })
    // Indoors, the roof catches a falling leaf, and the fly and the dog stay outside. A
    // sneeze or a call follows you in.
    const event = s.event
    const follows = event?.id === 'sneeze' || event?.id === 'ring'
    if (event?.stage === 'warning' && !follows) {
      endEvent(event, 'missed')
      this.events.push({ type: 'eventMissed', id: event.id, where: 'door' })
    }
    if (s.cat.mood === 'drinking') this.events.push({ type: 'catSeen' })
    trouble.maybeRain(this)
    const left = Math.max(
      this.waitLeftS(s.waits.refill),
      this.waitLeftS(s.waits.glue)
    )
    if (left >= DIRECTOR_MIN_LEFT_S) this.direct('houseArrive', left)
    // The bathroom slot: on a tub trip with no carry event, something follows you in.
    // Last Trip always gets one. It comes last, so a cat the director just set drinking
    // stays at the tub.
    if (s.containerIndex === 2 && !s.event) {
      const catFree = s.cat.mood === 'away' && !trouble.catBusy(this)
      const threat = rollBathroomThreat(
        this.random,
        s.current.lastTrip,
        catFree
      )
      if (threat) {
        s.event = threat
        s.eventTrips[threat.id] = s.trip
      }
    }
  }

  private updateHouse(dtMs: number, input: InputFrame): void {
    const s = this.state
    switch (s.phase) {
      case 'enter':
        if (carry.advanceEvent(this, dtMs, input)) return
        if (this.carryStep(dtMs, input, HOUSE_WALK)) return
        if (this.floorSlip()) return
        if (s.sieve.inSieve <= 0) return this.runDry()
        if (s.walker.distance >= HOUSE_WALK_METRES) this.startPour(input)
        return
      case 'pour':
        this.pourStep(dtMs, input)
        return
      case 'visit':
        // Arriving with walk held doesn't walk you straight out again. Only walk itself
        // leaves, so a thumb that misses the cat or the plug never walks you out.
        this.settle(dtMs, HOUSE_WALK.decel)
        if (!this.walkHeld(input)) s.house.leaveArmed = true
        else if (s.house.leaveArmed) this.goToWell()
        return
      default:
        this.settle(dtMs, HOUSE_WALK.decel)
        s.house.flow = 0
        if (s.phaseMs >= RESULT_MS) this.afterResult()
    }
  }

  /**
   * The house floor puddle sits on the walk-in: cross it faster than you'd slip on a wet
   * path and down you go, water and all. Returns true when it drained the sieve.
   */
  private floorSlip(): boolean {
    const s = this.state
    const walker = s.walker
    if (!s.house.floorPatch) return false
    if (Math.abs(walker.distance - FLOOR_PUDDLE_M) > FLOOR_PUDDLE_HALF_M)
      return false
    const assist = settings.get().assist
    if (walker.speed <= slipSpeed('wet', assist, s.kit.slippers)) return false
    this.body.pulse(SLIP_PULSE, SLIP_PULSE_MS, 'wetFloor')
    this.events.push({ type: 'slip', kind: 'wet', carrying: true })
    walker.speed = 0
    this.drain('wetFloor')
    return true
  }

  /** Once the result has shown: a cutscene if one is due, otherwise the walk back. */
  private afterResult(): void {
    const s = this.state
    const next = s.pendingCutscene
    s.pendingCutscene = null
    if (!next && this.houseNeedsYou()) {
      // A wet floor, the cat or the plug keeps you in the house until you deal with
      // them or walk off.
      this.endTrip()
      s.tripReport = this.tripReport()
      return this.enterVisit()
    }
    if (!next) return this.toWalkBack()
    this.endTrip()
    this.startCutscene(next)
  }

  /** The pour reads its own axis from here: no drift, no dribble, no tip. */
  private startPour(input: InputFrame): void {
    const s = this.state
    const house = s.house
    house.pourAnchorX = input.x
    house.pourValue = 0
    house.keyPour = 0
    house.flow = 0
    s.walker.speed = 0
    s.dribbling = false
    s.grip.tipMs = 0
    // Whatever followed you in carries on through the pour: blow, swat, freeze or answer.
    this.setPhase('pour')
  }

  private pourStep(dtMs: number, input: InputFrame): void {
    const s = this.state
    const house = s.house
    const dt = dtMs / 1000
    house.keyPour = stepKeyPour(house.keyPour, input.pour, dtMs)
    const fromPointer = !s.grip.held
      ? 0
      : input.mode === 'motion'
        ? Math.min(1, Math.max(0, input.tiltX / MOTION_POUR_DEGREES))
        : pointerPour(input.x, house.pourAnchorX)
    house.pourValue = Math.max(fromPointer, house.keyPour)
    s.tiltDeg = house.pourValue * 25
    if (carry.advanceEvent(this, dtMs, input)) return
    this.feedHand(input, dtMs)
    // Blowing at a fly mid-pour shakes the sieve like it does on the path.
    const ringing = s.event?.id === 'ring' && s.event.stage === 'warning'
    s.blowing = input.blow && !ringing
    this.updateLevels(s.blowing ? BLOW_PULSE : 0, dtMs)
    if (s.steady.total >= BREAK_LEVEL) return this.dump()

    this.drip(baseDripRate(s.sieve.inSieve, s.gear) * dt)
    this.leakHoles(dt)
    house.flow = pourFlow(house.pourValue)
    const ml = house.flow * 1000 * dt
    const splash = splashFraction(house.flow)
    this.pourOut(ml * (1 - splash), ml * splash)
    // A full container locks at once; whatever is left in the sieve drips away.
    const { def, ledger } = this.container()
    if (s.sieve.inSieve < EMPTY_ML || roomMl(ledger, def) <= 0)
      this.finishPour(false)
  }

  /** Moves poured water into the container, with overflow and splashes splashed. */
  private pourOut(landedMl: number, splashMl: number): void {
    const s = this.state
    const { def, ledger } = this.container()
    const room = roomMl(ledger, def)
    const kept = Math.min(landedMl, room)
    const moved = leak(s.sieve, 'delivered', kept)
    receive(ledger, moved)
    s.current.deliveredMl += moved
    s.stats.deliveredMl += moved
    // Overflow splashes too, but a full container isn't your fault: only real splashes count.
    const splashed = leak(s.sieve, 'splashed', splashMl + (landedMl - kept))
    s.current.splashedMl += splashed
    s.stats.lostByCause.splash += splashed
    this.countLoss(splashMl)
  }

  /** Letting go or breaking mid-pour: 40% lands, the rest splashes everywhere. */
  private dump(): void {
    const s = this.state
    const water = s.sieve.inSieve
    this.pourOut(water * DUMP_KEPT, water * (1 - DUMP_KEPT))
    moveAll(s.sieve, 'splashed')
    this.finishPour(true)
  }

  /** Ends the pour: pays coins and the No-Drip bonus, wets the floor, fills the container. */
  private finishPour(dumped: boolean): void {
    const s = this.state
    const leftover = moveAll(s.sieve, 'dripped')
    s.fx.dripMl += leftover
    const house = s.house
    house.flow = 0
    house.pourValue = 0
    // Anything still after you finds an empty sieve.
    const event = s.event
    if (event?.stage === 'warning') {
      endEvent(event, 'missed')
      if (event.caller) carry.callEnded(this, event.caller)
      this.events.push({ type: 'eventMissed', id: event.id, where: 'empty' })
    }
    const { coins, bonus } = this.payDelivery()
    s.hintsDone.pour = true
    this.setPhase('poured')
    this.events.push({
      type: 'poured',
      ml: s.current.deliveredMl,
      coins,
      bonus,
      dumped
    })
    if (s.current.splashedMl >= FLOOR_SPLASH_ML) {
      kit.soakSlippers(this)
      if (!house.floorPatch) {
        this.wetFloor()
        this.events.push({ type: 'floorSplash' })
      }
    }
    const { def, ledger } = this.container()
    const index = s.containerIndex
    if (!ledger.done && ledger.inContainer >= def.capacityMl) {
      ledger.done = true
      if (def.bonus > 0) this.wallet.earn(def.bonus, `${def.name} filled`)
      this.events.push({
        type: 'containerDone',
        index,
        name: def.name,
        bonus: def.bonus
      })
      // A full container is locked: the cat has nothing left to drink.
      if (s.cat.mood === 'drinking') {
        s.cat.mood = 'away'
        this.chores.complete(CAT_CHORE.id)
      }
      // Its cutscene plays after the result; the next container takes over now.
      s.pendingCutscene = CONTAINER_DONE[index] ?? null
      s.containerIndex = Math.min(CONTAINERS.length - 1, index + 1)
      this.updateSeason(true)
      return
    }
    if (def.id === 'tub') {
      const tubMl = ledger.inContainer
      const gag = milestoneGag(s.milestonesShown, tubMl)
      if (gag) {
        s.milestonesShown = milestonesPassed(tubMl)
        s.pendingCutscene = gag
        const line = MILESTONE_LINES[s.milestonesShown - 1] ?? ''
        s.share = { kind: 'milestone', trip: s.trip, line, tubMl }
      }
      // A Last Trip that poured and still fell short: so close it's worth a card.
      if (s.current.lastTrip && s.current.deliveredMl > 0) {
        const shortMl = def.capacityMl - tubMl
        s.share = { kind: 'nearMiss', trip: s.trip, shortMl, tubMl }
        this.events.push({ type: 'nearMiss', shortMl })
      }
    }
    this.updateSeason(false)
  }

  /** Pays coins and the No-Drip bonus for this trip's delivery, and notes it. */
  private payDelivery(): { coins: number; bonus: number } {
    const s = this.state
    const coins = coinsFor(s.current.deliveredMl)
    if (coins > 0) this.wallet.earn(coins, 'Delivery')
    const bonus = noDripBonus(s.current)
    if (bonus > 0) this.wallet.earn(bonus, 'No-Drip Trip')
    s.lastDeliveredMl = s.current.deliveredMl
    if (s.current.deliveredMl > 0) s.drainStreak = 0
    return { coins, bonus }
  }

  /** Moves the season on to match progress. It never turns back. */
  private updateSeason(quiet: boolean): void {
    const s = this.state
    const tubMl = s.containers[2]?.inContainer ?? 0
    const season = laterSeason(s.season, seasonFor(s.containerIndex, tubMl))
    if (season === s.season) return
    s.season = season
    this.events.push({ type: 'season', season, quiet })
  }

  // ---------------------------------------------------------------- Cutscenes

  /** Picks up play where the cutscene says: back at the well, running home, or the end. */
  private endCutscene(): void {
    const s = this.state
    const def = isCutscene(s.phase) ? CUTSCENES[s.phase] : CUTSCENES.coldOpen
    if (def.then === 'end') this.finishGame(def.ms)
    else if (def.then === 'walkBack') this.toWalkBack(PATH_METRES)
    else this.arriveAtWell()
  }

  /** The tub is full and the ending has played: stop the clock on its last frame. */
  private finishGame(lastFrameMs: number): void {
    const s = this.state
    if (s.ended) return
    s.phaseMs = lastFrameMs
    s.ended = true
    s.stats.endedAt = this.now()
    this.events.push({ type: 'ended' })
  }

  // ---------------------------------------------------------------- Walk back

  /** The trip is over: hints it taught are done, and a Last Trip that fell short is noted. */
  private endTrip(): void {
    const s = this.state
    if (s.trip > 0) s.hintsDone.noDrip = true
    if (s.trip > 1) s.hintsDone.drift = true
    if (s.carryMs >= FATIGUE_START_S * 1000) s.hintsDone.fatigue = true
    if (s.current.lastTrip && !s.containers[2]?.done) s.lastTripMissed = true
    kit.wearWax(this)
  }

  private toWalkBack(from = this.pathDistance()): void {
    const s = this.state
    const grip = s.grip
    // Never start the walk back standing in a puddle: step off its well side first.
    const puddle = patchAt(s.path, from)
    if (puddle) from = puddle.at - patchWidth(puddle) / 2 - 0.2
    this.endTrip()
    s.scene = 'walkBack'
    this.setPhase('return')
    s.walker = createWalker(Math.max(0, from), -1)
    resetRealWalk(s.realWalk)
    grip.held = false
    grip.tipMs = 0
    grip.offsetX = grip.offsetY = 0
    s.tiltDeg = 0
    s.dribbling = false
    // Any drops left in the sieve drip away on the run.
    if (s.sieve.inSieve > 0) leak(s.sieve, 'dripped', s.sieve.inSieve)
    s.tripReport = this.tripReport()
    stones.startStoneWalk(this)
    this.events.push({ type: 'scene', scene: 'walkBack' })
  }

  private tripReport(): string {
    const s = this.state
    const index = s.current.container
    const def = CONTAINERS[index]
    const ledger = s.containers[index]
    if (!def || !ledger) return ''
    const percent = Math.min(
      100,
      Math.floor((ledger.inContainer / def.capacityMl) * 100)
    )
    const name = def.name.toLowerCase()
    const got = s.current.deliveredMl
    if (got > 0 && s.current.lastTrip && !ledger.done)
      return `${(ledger.inContainer / 1000).toFixed(1)} L. So close.`
    return got > 0
      ? `${litres(got)}. The ${name} is ${percent}% full.`
      : `Nothing delivered. The ${name} is still ${percent}% full.`
  }

  private updateWalkBack(dtMs: number, input: InputFrame): void {
    const s = this.state
    this.settle(dtMs, 0)
    if (s.pratfallMs > 0) {
      s.pratfallMs = Math.max(0, s.pratfallMs - dtMs)
      return
    }
    const running = this.running(input)
    if (s.wipe) {
      if (!running) return
      // Walking away leaves the patch half wiped; the strokes stay on it.
      s.wipe = null
    }
    if (s.stone.placing) {
      if (!running) return
      stones.putStoneAway(this)
    }
    const from = s.walker.distance
    if (stepWalker(s.walker, running, RUN_WALK, dtMs))
      this.events.push({ type: 'footstep', speed: s.walker.speed })
    this.passPatches(from)
    const patch = patchAt(s.path, s.walker.distance)
    if (!patch || patch.id !== s.safePatch) s.safePatch = -1
    const assist = settings.get().assist
    const safe = patch?.id === s.safePatch
    const limit = patch ? slipSpeed(patch.kind, assist, s.kit.slippers) : 0
    if (patch && !safe && s.walker.speed > limit) {
      // Nothing to spill on an empty walk: just a pratfall, and soaked slippers.
      s.safePatch = patch.id
      s.walker.speed = 0
      s.pratfallMs = PRATFALL_MS
      this.events.push({ type: 'slip', kind: patch.kind, carrying: false })
      kit.soakSlippers(this)
      return
    }
    this.updatePrompt(running)
    if (!s.wipe) stones.stepStoneWalk(this, running)
    if (s.walker.dir < 0 && s.walker.distance <= 0) {
      s.hintsDone.walkBack = true
      this.arriveAtWell()
    } else if (s.walker.dir > 0 && s.walker.distance >= PATH_METRES) {
      this.arriveAtHouse()
    }
  }

  /**
   * Empty walks run on walk; in two-thumb mode any held thumb runs too, and walking for
   * real, each step runs for a moment.
   */
  private running(input: InputFrame): boolean {
    return this.walkHeld(input) || (input.mode === 'touch' && input.grip)
  }

  /** Walk is held: W, the walk pad or a thumb, or a real step a moment ago. */
  private walkHeld(input: InputFrame): boolean {
    const rw = this.state.realWalk
    return input.walk || (rw.active && rw.runMs > 0)
  }

  /**
   * On an empty walk, points the Wipe prompt at the nearest patch from WIPE_AHEAD_M ahead
   * to WIPE_BEHIND_M behind. Stopping on it opens the rub area; walking past it leaves a
   * chore to come back for.
   */
  private updatePrompt(running: boolean): void {
    const s = this.state
    const at = s.walker.distance
    const dir = s.walker.dir
    let best: Patch | null = null
    let bestGap = Infinity
    for (const patch of s.path.patches) {
      const ahead = (patch.at - at) * dir
      if (ahead > WIPE_AHEAD_M || ahead < -WIPE_BEHIND_M) continue
      if (Math.abs(ahead) < bestGap) {
        best = patch
        bestGap = Math.abs(ahead)
      }
    }
    const previous = patchById(s.path, s.promptPatch)
    const passed = previous && (previous.at - at) * dir < -WIPE_BEHIND_M
    if (previous && passed && this.chores.add(patchChore(previous)))
      this.events.push({ type: 'patchChore', at: previous.at })
    s.promptPatch = best?.id ?? -1
    const onIt = best && Math.abs(best.at - at) <= patchWidth(best) / 2 + 0.5
    if (best && onIt && !running && s.walker.speed < WIPE_STOP_SPEED)
      this.openWipe(best)
  }

  /** Opens the rub area over a path patch; you stop where you are. */
  private openWipe(patch: Patch): void {
    const s = this.state
    s.walker.speed = 0
    s.safePatch = patch.id
    s.wipe = {
      target: 'path',
      patchId: patch.id,
      needed: wipeStrokes(patch.kind),
      handX: 0,
      handY: 0,
      holding: false
    }
    this.events.push({ type: 'wipeOpen', target: 'path', kind: patch.kind })
  }

  /** The house floor got wet: a puddle to wipe on a house visit. */
  private wetFloor(): void {
    const house = this.state.house
    house.floorPatch = true
    house.floorWiped = 0
    this.chores.add(WIPE_FLOOR_CHORE)
  }

  /**
   * A new trip ages the path: patches dry, freeze or melt, and the season adds its own
   * mess. Chores follow: gone patches close theirs, frozen ones get relabelled.
   */
  private agePath(): void {
    const s = this.state
    const kinds = new Map(s.path.patches.map(p => [p.id, p.kind]))
    for (const patch of agePatches(s.path, s.season))
      this.chores.complete(patchChore(patch).id)
    for (const patch of s.path.patches) {
      const chore = patchChore(patch)
      if (kinds.get(patch.id) === patch.kind || !this.chores.has(chore.id))
        continue
      this.chores.complete(chore.id)
      this.chores.add(chore)
    }
    seasonPatches(s.path, s.season, this.random)
  }

  /** In the house with an empty sieve: do house chores, then walk back. */
  private enterVisit(): void {
    const s = this.state
    s.scene = 'house'
    stones.putStoneAway(this)
    this.setPhase('visit')
    s.walker = createWalker(HOUSE_WALK_METRES, 1)
    s.grip.held = false
    s.grip.tipMs = 0
    s.house.flow = 0
    s.house.pourValue = 0
    s.house.leaveArmed = false
    s.wipe = s.house.floorPatch
      ? {
          target: 'floor',
          patchId: -1,
          needed: WIPE_STROKES,
          handX: 0,
          handY: 0,
          holding: false
        }
      : null
  }

  /** The end of an empty walk to the house. */
  private arriveAtHouse(): void {
    const s = this.state
    this.enterVisit()
    this.events.push({ type: 'scene', scene: 'house' })
    if (s.cat.mood === 'drinking') this.events.push({ type: 'catSeen' })
    trouble.maybeRain(this)
    const left = Math.max(
      this.waitLeftS(s.waits.refill),
      this.waitLeftS(s.waits.glue)
    )
    if (left >= DIRECTOR_MIN_LEFT_S) this.direct('houseArrive', left)
  }

  /** Starts an empty walk: toward the house from the well, or back from the house. */
  private emptyWalk(dir: 1 | -1): void {
    const s = this.state
    s.scene = 'walkBack'
    this.setPhase(dir > 0 ? 'toHouse' : 'return')
    s.walker = createWalker(dir > 0 ? 0 : PATH_METRES, dir)
    resetRealWalk(s.realWalk)
    s.grip.held = false
    s.grip.tipMs = 0
    s.grip.offsetX = s.grip.offsetY = 0
    s.tiltDeg = 0
    s.wipe = null
    s.promptPatch = -1
    stones.startStoneWalk(this)
    // The walk back after a house visit keeps the trip report; other empty walks have none.
    if (dir > 0) s.tripReport = ''
    this.events.push({ type: 'scene', scene: 'walkBack' })
  }

  /** Back at the well with an empty sieve, from the walk back or a cutscene. */
  private arriveAtWell(): void {
    const s = this.state
    s.scene = 'well'
    // The walk back's share card goes with it.
    s.share = null
    stones.putStoneAway(this)
    s.walker = createWalker(0, 1)
    s.grip.held = false
    s.grip.tipMs = 0
    s.well.sieveY = SIEVE_HOVER_Y
    s.well.dipped = false
    s.well.dipGainMl = 0
    s.well.tipDip = false
    s.grip.offsetX = s.grip.offsetY = 0
    this.setPhase(this.wellPhase())
    this.events.push({ type: 'scene', scene: 'well' })
    const refillLeft = this.waitLeftS(s.waits.refill)
    if (refillLeft >= DIRECTOR_MIN_LEFT_S)
      this.direct('refillArrive', refillLeft)
    const glueLeft = this.waitLeftS(s.waits.glue)
    if (glueLeft >= DIRECTOR_MIN_LEFT_S) this.direct('glueStart', glueLeft)
  }
}

/** Chores built so far that the director can open. Later milestones add theirs. */
const AVAILABLE_CHORES: ReadonlySet<ChoreKind> = new Set<ChoreKind>([
  'frog',
  'wipe',
  'leaves',
  'cat',
  'plug',
  'rewax'
])

/** Carry events built so far that can roll. Later milestones add theirs. */
const AVAILABLE_EVENTS: ReadonlySet<CarryEventId> = new Set<CarryEventId>([
  'leaf',
  'fly',
  'sneeze',
  'dog',
  'ring'
])

/** Where the crank handle's knob sits for an angle, in logical units. */
export function crankHandle(
  angle: number,
  out: { x: number; y: number } = { x: 0, y: 0 }
): { x: number; y: number } {
  out.x = CRANK_X + Math.cos(angle) * CRANK_RADIUS
  out.y = CRANK_Y + Math.sin(angle) * CRANK_RADIUS
  return out
}
