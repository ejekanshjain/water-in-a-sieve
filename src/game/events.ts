import type { Rng } from '../shared'
import type { Caller } from './calls'
import {
  ANKLE_RUB_GAP_MS,
  ANKLE_STOP_SPEED,
  ANKLE_WARN_MS,
  ANKLE_WEAVE_MS,
  BATH_FLY_CIRCLE_MS,
  BATH_THREAT_CHANCE,
  BATH_THREAT_FROM_M,
  BATH_THREAT_TO_M,
  BLOW_MS,
  DOG_STOP_SPEED,
  DOG_WARN_MS,
  EVENT_COOLDOWN_TRIPS,
  EVENT_FROM_M,
  EVENT_TO_M,
  FIRST_EVENT_TRIP,
  FLY_CIRCLE_MS,
  FLY_GIVE_UP_BLOWS,
  FLY_RETREAT_MS,
  FLY_RETURN_CIRCLE_MS,
  FLY_SHADOW_MS,
  LEAF_FALL_MS,
  LEAF_SHADOW_MS,
  MAX_EVENT_CHANCE,
  RING_BUZZ_GAP_MS,
  RING_FROM_TRIP,
  RING_MS,
  RING_WARN_MS,
  SNEEZE_FAKE_CHANCE,
  SNEEZE_FROM_MS,
  SNEEZE_STILL_LEVEL,
  SNEEZE_STILL_SPEED,
  SNEEZE_TO_MS
} from './tuning'
import type { Season } from './types'

/**
 * Things that can happen to you while you carry water. `catAnkles` only follows you into
 * the bathroom: the cat weaving round your feet.
 */
export type CarryEventId =
  'fly' | 'leaf' | 'sneeze' | 'dog' | 'ring' | 'catAnkles'

/** Each carry event's chance per trip, by season. */
export const CARRY_WEIGHTS: Record<
  Season,
  Partial<Record<CarryEventId, number>>
> = {
  summer: { fly: 0.25, dog: 0.1, sneeze: 0.08 },
  autumn: { fly: 0.1, leaf: 0.12, dog: 0.1, sneeze: 0.12, ring: 0.08 },
  winter: { dog: 0.05, sneeze: 0.25, ring: 0.08 },
  spring: { fly: 0.2, dog: 0.1, sneeze: 0.15, ring: 0.08 }
}

/** The one carry event of a trip. It waits for you at `at`, warns, then resolves. */
export interface CarryEvent {
  id: CarryEventId
  /** Metres along the path where it starts. */
  at: number
  /** `waiting` until you reach `at`, `warning` while it telegraphs, `over` once resolved. */
  stage: 'waiting' | 'warning' | 'over'
  /** Time into the current approach, in ms. */
  ms: number
  /** How long this approach warns before it can hurt you. */
  warnMs: number
  /** The landing shadow shows for this last part of the warning; 0 for a sneeze. */
  shadowMs: number
  /** Where it lands, relative to the sieve's centre in the cam, in logical units. */
  landX: number
  landY: number
  /** Which side it comes in from: -1 left, 1 right. */
  side: 1 | -1
  /** Blowing held at it during this approach, in ms. */
  blowMs: number
  /** The fly: blows that drove it off so far. */
  blows: number
  /** The fly: time left zooming away after a blow, before it comes back. */
  retreatMs: number
  /** The sneeze: a fake-out that never comes. */
  fake: boolean
  /** A phone call: who's ringing. */
  caller: Caller | null
  /** A phone call: time left listening after you answered. */
  talkMs: number
  /** A phone call: when an ignored call buzzes next, in ms into the ring. */
  nextBuzzMs: number
  /** A call from the interviewer: your answer to the question, once you give one. */
  choice: 'e' | 'f' | null
  /** It followed you into the bathroom: the walk-in and pour slot, not a carry event. */
  bathroom: boolean
  outcome: 'none' | 'countered' | 'failed' | 'missed' | 'fake'
}

/** What the roll needs to know. */
export interface EventContext {
  trip: number
  season: Season
  /** Events built so far. Later milestones add theirs. */
  available: ReadonlySet<CarryEventId>
  /** The trip each event last happened on. */
  lastTrip: Partial<Record<CarryEventId, number>>
}

/** Events that can roll this trip with their weights, scaled so they sum to at most 60%. */
export function eventChances(ctx: EventContext): [CarryEventId, number][] {
  if (ctx.trip < FIRST_EVENT_TRIP) return []
  const out: [CarryEventId, number][] = []
  let total = 0
  const weights = CARRY_WEIGHTS[ctx.season]
  for (const id of Object.keys(weights) as CarryEventId[]) {
    const weight = weights[id] ?? 0
    const last = ctx.lastTrip[id]
    const cooling =
      last !== undefined && ctx.trip - last <= EVENT_COOLDOWN_TRIPS
    // Nobody has your number until trip 12.
    const early = id === 'ring' && ctx.trip < RING_FROM_TRIP
    if (weight <= 0 || !ctx.available.has(id) || cooling || early) continue
    out.push([id, weight])
    total += weight
  }
  if (total > MAX_EVENT_CHANCE)
    for (const pair of out) pair[1] *= MAX_EVENT_CHANCE / total
  return out
}

/** What can follow you into the bathroom. */
export const BATH_THREATS: readonly CarryEventId[] = [
  'fly',
  'catAnkles',
  'sneeze'
]

/**
 * The bathroom slot, rolled as you reach the house on a bathtub trip with no carry event:
 * 15% of the time, or always when `guaranteed` (Last Trip). The cat only comes when
 * `catFree`. It starts early in the
 * walk-in and can carry on into the pour. The fly through the door circles for less
 * time, since the walk-in is short.
 */
export function rollBathroomThreat(
  random: Rng,
  guaranteed: boolean,
  catFree = true
): CarryEvent | null {
  if (!guaranteed && random() >= BATH_THREAT_CHANCE) return null
  // A cat busy at the tub, or with its treats, can't be at your ankles too.
  const threats = catFree ? BATH_THREATS : NO_CAT_THREATS
  const id = threats[Math.floor(random() * threats.length)] ?? 'fly'
  return createBathroomEvent(id, random)
}

const NO_CAT_THREATS = BATH_THREATS.filter(id => id !== 'catAnkles')

/** A threat that follows you in, starting early in the walk-in; the cat at the door. */
export function createBathroomEvent(id: CarryEventId, random: Rng): CarryEvent {
  const at =
    BATH_THREAT_FROM_M + random() * (BATH_THREAT_TO_M - BATH_THREAT_FROM_M)
  // The cat is waiting at the door: it reaches your feet before you reach the tub.
  const event = createEvent(id, id === 'catAnkles' ? 0 : at, random)
  if (id === 'fly') event.warnMs = BATH_FLY_CIRCLE_MS + event.shadowMs
  event.bathroom = true
  return event
}

/** Rolls the trip's carry event once, when the scoop lifts. Null most trips. */
export function rollCarryEvent(
  ctx: EventContext,
  random: Rng
): CarryEvent | null {
  const chances = eventChances(ctx)
  if (chances.length === 0) return null
  let roll = random()
  for (const [id, chance] of chances) {
    if (roll < chance) {
      const at = EVENT_FROM_M + random() * (EVENT_TO_M - EVENT_FROM_M)
      return createEvent(id, at, random)
    }
    roll -= chance
  }
  return null
}

/**
 * An event that starts at `at` metres. Every event warns at least 1.2s before it can hurt
 * you. Assist Mode leaves warnings alone: it helps shaky hands, not slow reactions.
 */
export function createEvent(
  id: CarryEventId,
  at: number,
  random: Rng
): CarryEvent {
  const a = random() * Math.PI * 2
  const r = random() * 34
  const event: CarryEvent = {
    id,
    at,
    stage: 'waiting',
    ms: 0,
    warnMs: 0,
    shadowMs: 0,
    landX: Math.cos(a) * r,
    landY: Math.sin(a) * r,
    side: random() < 0.5 ? -1 : 1,
    blowMs: 0,
    blows: 0,
    retreatMs: 0,
    fake: false,
    caller: null,
    talkMs: 0,
    nextBuzzMs: 0,
    choice: null,
    bathroom: false,
    outcome: 'none'
  }
  if (id === 'leaf') {
    event.warnMs = LEAF_FALL_MS
    event.shadowMs = LEAF_SHADOW_MS
  } else if (id === 'fly') {
    event.shadowMs = FLY_SHADOW_MS
    event.warnMs = FLY_CIRCLE_MS + event.shadowMs
  } else if (id === 'dog') {
    event.warnMs = DOG_WARN_MS
  } else if (id === 'ring') {
    event.warnMs = RING_WARN_MS
  } else if (id === 'catAnkles') {
    event.warnMs = ANKLE_WARN_MS
  } else {
    event.warnMs = SNEEZE_FROM_MS + random() * (SNEEZE_TO_MS - SNEEZE_FROM_MS)
    event.fake = random() < SNEEZE_FAKE_CHANCE
  }
  return event
}

/** What you're doing while an event plays out. */
export interface EventInput {
  dtMs: number
  blow: boolean
  /** A swatter swing started this step. */
  swat?: boolean
  /** Walking speed in m/s. */
  speed: number
  /** Total steadiness level. */
  total: number
}

/** What one step of an event did, for the sim to turn into water and effects. */
export type EventOutcome =
  | 'none'
  /** A leaf blown off, or a fly driven back for now. */
  | 'blown'
  /** A blown fly came back for another go, faster and angrier. */
  | 'returned'
  /** The fly gave up after enough blows. */
  | 'gaveUp'
  /** One swat killed the fly or the leaf. */
  | 'swatted'
  /** A leaf or fly landed on the water. */
  | 'landed'
  /** The sneeze came while you moved. */
  | 'sneezed'
  /** You froze and held it in. */
  | 'heldIn'
  /** It was a fake-out. */
  | 'neverMind'
  /** You'd stopped, so the dog ran between your legs, or the cat got bored of them. */
  | 'passed'
  /** The dog or the cat tripped you. */
  | 'tripped'
  /** The cat rubbed against your legs. */
  | 'rubbed'
  /** An ignored call buzzed in your pocket. */
  | 'buzz'
  /** An ignored call rang out. */
  | 'ignored'
  /** An answered call ended. */
  | 'hungUp'

/** Advances a warning event by one step and resolves it when its moment comes. */
export function stepEvent(event: CarryEvent, input: EventInput): EventOutcome {
  if (event.stage !== 'warning') return 'none'
  if (event.talkMs > 0) {
    // On the phone: the caller talks until they're done.
    event.talkMs -= input.dtMs
    if (event.talkMs > 0) return 'none'
    end(event, 'countered')
    return 'hungUp'
  }
  if (event.retreatMs > 0) {
    // A blown fly zooms off, then comes back with less patience.
    event.retreatMs -= input.dtMs
    if (event.retreatMs > 0) return 'none'
    event.retreatMs = 0
    event.ms = 0
    event.blowMs = 0
    event.warnMs = FLY_RETURN_CIRCLE_MS + event.shadowMs
    return 'returned'
  }
  event.ms += input.dtMs
  if (event.id === 'sneeze') return stepSneeze(event, input)
  if (event.id === 'dog') return stepDog(event, input)
  if (event.id === 'catAnkles') return stepAnkles(event, input)
  if (event.id === 'ring') return stepRing(event)
  // A swat that connects ends it for good; a fly zooming off after a blow is out of reach.
  if (input.swat) {
    end(event, 'countered')
    return 'swatted'
  }
  if (input.blow) event.blowMs += input.dtMs
  if (event.blowMs >= BLOW_MS) {
    if (event.id === 'leaf') {
      end(event, 'countered')
      return 'blown'
    }
    event.blows++
    if (event.blows >= FLY_GIVE_UP_BLOWS) {
      end(event, 'countered')
      return 'gaveUp'
    }
    event.retreatMs = FLY_RETREAT_MS
    event.blowMs = 0
    return 'blown'
  }
  if (event.ms < event.warnMs) return 'none'
  end(event, 'failed')
  return 'landed'
}

/** "Ah…", "Ah…!", then the sneeze: held in only if you're stopped and steady. */
function stepSneeze(event: CarryEvent, input: EventInput): EventOutcome {
  if (event.ms < event.warnMs) return 'none'
  if (event.fake) {
    end(event, 'fake')
    return 'neverMind'
  }
  const still =
    input.speed < SNEEZE_STILL_SPEED && input.total < SNEEZE_STILL_LEVEL
  end(event, still ? 'countered' : 'failed')
  return still ? 'heldIn' : 'sneezed'
}

/** The dog arrives: stopped, it runs between your legs; walking, it trips you. */
function stepDog(event: CarryEvent, input: EventInput): EventOutcome {
  if (event.ms < event.warnMs) return 'none'
  const stopped = input.speed < DOG_STOP_SPEED
  end(event, stopped ? 'countered' : 'failed')
  return stopped ? 'passed' : 'tripped'
}

/**
 * The cat trots in, then weaves round your ankles: walk at all while it weaves and you go
 * over it. Stand still and it rubs your legs a few times, then wanders off.
 */
function stepAnkles(event: CarryEvent, input: EventInput): EventOutcome {
  if (event.ms < event.warnMs) return 'none'
  if (input.speed >= ANKLE_STOP_SPEED) {
    end(event, 'failed')
    return 'tripped'
  }
  if (event.ms >= event.warnMs + ANKLE_WEAVE_MS) {
    end(event, 'countered')
    return 'passed'
  }
  if (event.ms < event.warnMs + event.nextBuzzMs) return 'none'
  event.nextBuzzMs += ANKLE_RUB_GAP_MS
  return 'rubbed'
}

/** An unanswered call: it rings, then buzzes in your pocket until it rings out. */
function stepRing(event: CarryEvent): EventOutcome {
  if (event.ms >= RING_MS) {
    end(event, 'missed')
    return 'ignored'
  }
  if (event.ms < event.warnMs || event.ms < event.nextBuzzMs) return 'none'
  event.nextBuzzMs = event.ms + RING_BUZZ_GAP_MS
  return 'buzz'
}

/** Picks up a ringing call: you stop and listen for `talkMs`. */
export function answerCall(event: CarryEvent, talkMs: number): boolean {
  if (event.id !== 'ring' || event.stage !== 'warning' || event.talkMs > 0)
    return false
  event.talkMs = talkMs
  return true
}

/** Declines a ringing call. */
export function declineCall(event: CarryEvent): boolean {
  if (event.id !== 'ring' || event.stage !== 'warning' || event.talkMs > 0)
    return false
  end(event, 'countered')
  return true
}

/** Answers the interviewer's question while they're on the line. */
export function chooseAnswer(event: CarryEvent, choice: 'e' | 'f'): boolean {
  const asking = event.caller === 'interviewer' && event.talkMs > 0
  if (event.stage !== 'warning' || !asking || event.choice) return false
  event.choice = choice
  return true
}

/** Resolves an event. */
export function endEvent(
  event: CarryEvent,
  outcome: CarryEvent['outcome']
): void {
  event.stage = 'over'
  event.outcome = outcome
}

const end = endEvent

/** Where something lands or flies, relative to the sieve's centre, and how high it is. */
export interface LeafSpot {
  x: number
  y: number
  /** 1 high above the water, 0 on it. */
  height: number
}

/** A falling leaf swings in from one side and settles on its landing spot. */
export function leafSpot(event: CarryEvent, out: LeafSpot): LeafSpot {
  const t = Math.min(1, event.ms / event.warnMs)
  const k = Math.pow(1 - t, 1.4)
  const sway = Math.sin(t * 9) * 26 * (1 - t)
  out.x = event.landX + event.side * 120 * k + sway
  out.y = event.landY - 170 * k
  out.height = 1 - t
  return out
}

/** How far out the fly circles the sieve, in logical units. */
const FLY_ORBIT = 96

/** The fly's angle around the sieve `ms` into an approach; it spins faster once angry. */
function flyAngle(event: CarryEvent, ms: number): number {
  const spin = event.blows > 0 ? 6.5 : 4
  return event.side * (ms / 1000) * spin + (event.side > 0 ? 0 : Math.PI)
}

function flyOrbit(ms: number): number {
  return FLY_ORBIT + Math.sin(ms / 130) * 12
}

/**
 * Where the fly is `ms` into its approach: circling the sieve, then diving onto its
 * landing spot for the shadow's last stretch. While blown back it zooms off outward.
 */
export function flySpotAt(
  event: CarryEvent,
  ms: number,
  out: LeafSpot
): LeafSpot {
  const circleMs = event.warnMs - event.shadowMs
  if (event.retreatMs > 0) {
    const a = flyAngle(event, ms)
    const r = flyOrbit(ms) * (1 + (1 - event.retreatMs / FLY_RETREAT_MS) * 2)
    out.x = Math.cos(a) * r
    out.y = Math.sin(a) * r
    out.height = 1
    return out
  }
  if (ms <= circleMs) {
    const a = flyAngle(event, ms)
    out.x = Math.cos(a) * flyOrbit(ms)
    out.y = Math.sin(a) * flyOrbit(ms) * 0.8
    out.height = 1
    return out
  }
  // The dive: from where it left the circle down onto the water.
  const a = flyAngle(event, circleMs)
  const t = Math.min(1, (ms - circleMs) / event.shadowMs)
  const ease = t * t
  const fromX = Math.cos(a) * flyOrbit(circleMs)
  const fromY = Math.sin(a) * flyOrbit(circleMs) * 0.8
  out.x = fromX + (event.landX - fromX) * ease + Math.sin(ms / 60) * 6 * (1 - t)
  out.y = fromY + (event.landY - fromY) * ease
  out.height = 1 - t
  return out
}

/** Where a leaf or fly is now, relative to the sieve's centre; null for a sneeze. */
export function eventSpot(event: CarryEvent, out: LeafSpot): LeafSpot | null {
  if (event.id === 'leaf') return leafSpot(event, out)
  if (event.id === 'fly') return flySpotAt(event, event.ms, out)
  return null
}

/** True while the landing shadow shows: the last moments before it lands. */
export function shadowShowing(event: CarryEvent): boolean {
  return (
    event.stage === 'warning' &&
    event.retreatMs <= 0 &&
    event.shadowMs > 0 &&
    event.warnMs - event.ms <= event.shadowMs
  )
}
