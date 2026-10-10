import { interviewQuestion, nextCaller, type Caller } from './calls'
import {
  answerCall as pickUp,
  chooseAnswer as pickAnswer,
  createBathroomEvent,
  createEvent,
  declineCall as reject,
  eventSpot,
  stepEvent,
  type CarryEvent,
  type CarryEventId,
  type LeafSpot
} from './events'
import type { Sim } from './sim'
import {
  ANKLE_RUB_PULSE,
  ANKLE_RUB_PULSE_MS,
  CAM_OFFSET_SCALE,
  CAM_X,
  CAM_Y,
  DECLINE_PULSE,
  DECLINE_PULSE_MS,
  DOG_PASS_PULSE,
  DOG_PASS_PULSE_MS,
  DOG_TRIP_PULSE,
  DOG_TRIP_PULSE_MS,
  LAND_PULSE,
  LAND_PULSE_MS,
  MUM_COINS,
  RING_BUZZ_PULSE,
  RING_BUZZ_PULSE_MS,
  SNEEZE_HELD_PULSE,
  SNEEZE_PULSE,
  SNEEZE_PULSE_MS,
  SWAT_PULSE,
  SWAT_PULSE_MS,
  SWING_MS,
  TALK_MS
} from './tuning'
import type { InputFrame, LossCause } from './types'

/**
 * The trip's carry event as the sim sees it: dev triggers, phone calls, the swatter, and
 * turning each event outcome into drains and pulses. The rules of each event live in
 * `events.ts`.
 */

/**
 * Sends a bathroom threat after you (dev and tests): it starts early in this trip's
 * walk-in, or now if you're already in the house carrying or pouring.
 */
export function triggerBathroom(sim: Sim, id: CarryEventId): void {
  const s = sim.state
  const event = createBathroomEvent(id, sim.random)
  const indoors =
    s.scene === 'house' && (s.phase === 'enter' || s.phase === 'pour')
  if (indoors) event.at = Math.min(event.at, s.walker.distance)
  if (id === 'ring') event.caller = nextCaller(s.calls)
  if (indoors || (s.scene === 'path' && s.phase === 'carry')) s.event = event
  else s.queuedEvent = event
  s.eventTrips[id] = s.trip
}

/**
 * Starts a carry event (dev and tests): now if you're carrying, otherwise on your next
 * carry, 20 m out.
 */
export function triggerEvent(sim: Sim, id: CarryEventId): void {
  const s = sim.state
  const carrying = s.scene === 'path' && s.phase === 'carry'
  const at = carrying ? s.walker.distance : 20
  const event = createEvent(id, at, sim.random)
  if (id === 'ring') event.caller = nextCaller(s.calls)
  if (carrying) {
    s.event = event
    s.eventTrips[id] = s.trip
  } else {
    s.queuedEvent = event
  }
}

/** E or the Answer button: you stop and listen while the caller talks. */
export function answerCall(sim: Sim): boolean {
  const s = sim.state
  const event = s.event
  if (!event?.caller || !pickUp(event, TALK_MS)) return false
  s.hintsDone.ring = true
  if (event.caller === 'interviewer') s.calls.questions++
  // Mum sends snack money.
  if (event.caller === 'mum') sim.wallet.earn(MUM_COINS, 'Mum')
  sim.events.push({ type: 'call', caller: event.caller, what: 'answered' })
  return true
}

/** F or the Decline button: a small jab, and Mum calls back next trip. */
export function declineCall(sim: Sim): boolean {
  const s = sim.state
  const event = s.event
  if (!event?.caller || !reject(event)) return false
  s.hintsDone.ring = true
  sim.body.pulse(DECLINE_PULSE, DECLINE_PULSE_MS, 'ring')
  if (event.caller === 'mum') s.calls.callback = 'mum'
  callEnded(sim, event.caller)
  sim.events.push({ type: 'call', caller: event.caller, what: 'declined' })
  return true
}

/** Answers the interviewer's question with E (the first answer) or F (the second). */
export function chooseAnswer(sim: Sim, choice: 'e' | 'f'): boolean {
  const s = sim.state
  const event = s.event
  if (!event?.caller || !pickAnswer(event, choice)) return false
  const question = interviewQuestion(s.calls.questions - 1)
  s.calls.answer = choice === 'e' ? question.e : question.f
  sim.events.push({ type: 'call', caller: event.caller, what: 'chose' })
  return true
}

/** The interviewer's question while they wait for your answer, or null. */
export function interviewChoices(
  sim: Sim
): { question: string; e: string; f: string } | null {
  const event = sim.state.event
  if (!event || event.caller !== 'interviewer' || event.talkMs <= 0) return null
  if (event.choice || event.stage !== 'warning') return null
  return interviewQuestion(sim.state.calls.questions - 1)
}

/** A call is over: the scam rings twice in a row. */
export function callEnded(sim: Sim, caller: Caller): void {
  const calls = sim.state.calls
  if (caller !== 'scam') return
  if (calls.scamAgain) calls.scamAgain = false
  else if (!calls.callback) {
    calls.callback = 'scam'
    calls.scamAgain = true
  }
}

/**
 * Where a falling leaf or a fly is in the cam now, in logical units, for blowing at it
 * with a finger. Null when there's nothing to blow at.
 */
export function blowTarget(sim: Sim, out: LeafSpot): LeafSpot | null {
  const s = sim.state
  const event = s.event
  if (!event || event.stage !== 'warning' || event.retreatMs > 0) return null
  if (!eventSpot(event, out)) return null
  out.x += CAM_X + s.grip.offsetX * CAM_OFFSET_SCALE
  out.y += CAM_Y + s.grip.offsetY * CAM_OFFSET_SCALE
  return out
}

/** True while a fly or a falling leaf is out and you own the swatter: the Swat button shows. */
export function swatReady(sim: Sim): boolean {
  const s = sim.state
  const event = s.event
  const target = event?.id === 'fly' || event?.id === 'leaf'
  return s.kit.swatter && target && event?.stage === 'warning'
}

/**
 * Swings the swatter if you pressed R or Swat, own one, and aren't mid-swing. Every swing
 * jolts the sieve, whether it hits anything or not. Returns true when a swing started.
 */
function swing(sim: Sim, pressed: boolean): boolean {
  const kit = sim.state.kit
  const queued = kit.swatQueued
  kit.swatQueued = false
  if (!(pressed || queued) || !kit.swatter || kit.swingMs > 0) return false
  kit.swingMs = SWING_MS
  sim.state.hintsDone.swatter = true
  sim.body.pulse(SWAT_PULSE, SWAT_PULSE_MS, 'swat')
  const event = sim.state.event
  const target =
    event?.stage === 'warning' &&
    event.retreatMs <= 0 &&
    (event.id === 'fly' || event.id === 'leaf')
  sim.events.push({ type: 'swing', target })
  return true
}

/**
 * Advances the trip's carry event while you carry water: it starts once you reach its
 * spot and warns, then you counter it or it costs you the water. Failed counters drain
 * directly, whatever the levels say. Returns true when it drained the sieve.
 */
export function advanceEvent(
  sim: Sim,
  dtMs: number,
  input: InputFrame
): boolean {
  const s = sim.state
  const swat = swing(sim, input.swat)
  const event = s.event
  if (!event || event.stage === 'over') return false
  // A threat waiting for the bathroom waits for the house.
  if (event.bathroom && s.scene !== 'house') return false
  if (event.stage === 'waiting') {
    if (s.walker.distance < event.at) return false
    event.stage = 'warning'
    sim.events.push({ type: 'eventStart', id: event.id })
  }
  if (event.id === 'ring') {
    // E answers and F declines; while the interviewer asks, they pick an answer.
    if (event.talkMs > 0) {
      if (input.answer) chooseAnswer(sim, 'e')
      else if (input.decline) chooseAnswer(sim, 'f')
    } else if (input.answer) answerCall(sim)
    else if (input.decline) declineCall(sim)
    if (event.stage !== 'warning') return false
  }
  const outcome = stepEvent(event, {
    dtMs,
    blow: input.blow,
    swat,
    speed: s.walker.speed,
    total: s.steady.total
  })
  if (outcome === 'none') return false
  if (event.bathroom && isOver(event)) s.hintsDone.bathroom = true
  sim.events.push({ type: 'eventStep', id: event.id, outcome })
  switch (outcome) {
    case 'tripped':
      // Between your legs at full tilt: you go over, and so does the water.
      sim.body.pulse(DOG_TRIP_PULSE, DOG_TRIP_PULSE_MS, causeOf(event.id))
      s.walker.speed = 0
      sim.drain(causeOf(event.id))
      return true
    case 'passed':
      if (event.id === 'dog') {
        sim.body.pulse(DOG_PASS_PULSE, DOG_PASS_PULSE_MS, 'dog')
        s.hintsDone.dog = true
      } else s.hintsDone.catAnkles = true
      return false
    case 'rubbed':
      // It leans on your shins: a nudge, more so mid-pour.
      sim.body.pulse(ANKLE_RUB_PULSE, ANKLE_RUB_PULSE_MS, 'cat')
      return false
    case 'buzz':
      // It buzzes in your pocket; too much and the water goes.
      sim.body.pulse(RING_BUZZ_PULSE, RING_BUZZ_PULSE_MS, 'ring')
      return false
    case 'ignored':
    case 'hungUp':
      if (event.caller) callEnded(sim, event.caller)
      return false
    case 'landed':
      // On the water, and the water goes straight through the mesh.
      sim.body.pulse(LAND_PULSE, LAND_PULSE_MS, causeOf(event.id))
      sim.drain(causeOf(event.id))
      return true
    case 'sneezed':
      sim.body.pulse(SNEEZE_PULSE, SNEEZE_PULSE_MS, 'sneeze')
      sim.drain('sneeze')
      return true
    case 'heldIn':
      sim.body.pulse(SNEEZE_HELD_PULSE, SNEEZE_PULSE_MS, 'sneeze')
      s.hintsDone.sneeze = true
      return false
    case 'gaveUp':
      s.stats.fliesBlown++
      s.hintsDone.fly = true
      return false
    case 'swatted':
      if (event.id === 'fly') {
        s.stats.fliesSwatted++
        s.hintsDone.fly = true
      } else s.hintsDone.leaf = true
      return false
    case 'blown':
      if (event.id === 'leaf') s.hintsDone.leaf = true
      return false
    default:
      return false
  }
}

/** True once an event has resolved. A function call, so the check survives `stepEvent` ending it. */
function isOver(event: CarryEvent): boolean {
  return event.stage === 'over'
}

/** The loss cause when a carry event costs you the water. */
function causeOf(id: CarryEventId): LossCause {
  return id === 'leaf' ? 'leaves' : id === 'catAnkles' ? 'cat' : id
}
