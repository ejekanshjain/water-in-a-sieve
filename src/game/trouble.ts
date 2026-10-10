import { catWants, plugFits } from './cat'
import { CAT_CHORE, PLUG_CHORE } from './chores'
import { startRain } from './rain'
import type { Sim } from './sim'
import {
  CAT_TRIP_CHANCE,
  PLUG_REST_X,
  PLUG_REST_Y,
  PLUG_TRIP_CHANCE,
  RAIN_CHANCE
} from './tuning'

/**
 * Trouble at the house while you're out: the cat drinking your water, the cat pulling the
 * bathtub plug, and spring rain through the skylight. Losses step in `cat.ts` and
 * `rain.ts`; this module starts and ends them.
 */

/** House chores need your hands free: on a house visit, with the sieve put down. */
export function canTouchHouse(sim: Sim): boolean {
  const s = sim.state
  return (
    s.scene === 'house' &&
    s.phase === 'visit' &&
    !s.paused &&
    s.holdStillMs <= 0
  )
}

/** Something in the house needs you: a wet floor, the cat or the plug. */
export function houseNeedsYou(sim: Sim): boolean {
  const s = sim.state
  return s.house.floorPatch || s.cat.mood === 'drinking' || s.cat.plugOut
}

/** True while treats keep the cat busy, so it leaves your water and the plug alone. */
export function catBusy(sim: Sim): boolean {
  return sim.state.kit.treatTrips > 0
}

/**
 * The cat starts drinking from a container worth drinking from. Treats keep it away,
 * unless `force` (dev tools).
 */
export function startCat(sim: Sim, force = false): boolean {
  const s = sim.state
  const { ledger } = sim.container()
  if (s.cat.mood !== 'away' || !catWants(ledger)) return false
  if (catBusy(sim) && !force) return false
  s.cat.mood = 'drinking'
  sim.chores.add(CAT_CHORE)
  sim.events.push({ type: 'catStart', scene: s.scene })
  return true
}

/** In the bathtub phase, the cat yanks the plug chain and the tub starts draining. */
export function pullPlug(sim: Sim, force = false): boolean {
  const s = sim.state
  const tub = s.containers[2]
  if (s.containerIndex !== 2 || !tub || tub.done || s.cat.plugOut) return false
  if (catBusy(sim) && !force) return false
  s.cat.plugOut = true
  s.cat.plugHeld = false
  s.cat.plugX = PLUG_REST_X
  s.cat.plugY = PLUG_REST_Y
  sim.chores.add(PLUG_CHORE)
  sim.events.push({ type: 'plugPulled', scene: s.scene })
  return true
}

/**
 * A trip starts: the cat gets up to mischief while you're away, at most one kind per
 * trip. A trip with treats left uses one up instead.
 */
export function rollHouseTrouble(sim: Sim): void {
  const s = sim.state
  if (s.kit.treatTrips > 0) {
    s.kit.treatTrips--
    return
  }
  const { ledger } = sim.container()
  const drinks =
    s.cat.mood === 'away' &&
    catWants(ledger) &&
    sim.random() < CAT_TRIP_CHANCE &&
    startCat(sim)
  const tub = s.containerIndex === 2 && !s.cat.plugOut && !ledger.done
  if (!drinks && tub && sim.random() < PLUG_TRIP_CHANCE) pullPlug(sim)
}

/** A tap on the cat: it puffs up, leaps off and stops drinking. */
export function shooCat(sim: Sim): boolean {
  const s = sim.state
  if (!canTouchHouse(sim) || s.cat.mood !== 'drinking') return false
  s.cat.mood = 'away'
  sim.chores.complete(CAT_CHORE.id)
  s.hintsDone.cat = true
  sim.events.push({ type: 'catShooed', room: s.containerIndex })
  return true
}

/** The pulled plug follows your pointer back toward the plughole. */
export function dragPlug(sim: Sim, x: number, y: number): void {
  const cat = sim.state.cat
  if (!cat.plugOut || !canTouchHouse(sim)) return
  cat.plugHeld = true
  cat.plugX = x
  cat.plugY = y
}

/** Drops the plug: in the hole it stops the drain, anywhere else it swings back. */
export function dropPlug(sim: Sim, x: number, y: number): boolean {
  const s = sim.state
  const cat = s.cat
  if (!cat.plugHeld) return false
  cat.plugHeld = false
  cat.plugX = PLUG_REST_X
  cat.plugY = PLUG_REST_Y
  if (!cat.plugOut || !canTouchHouse(sim) || !plugFits(x, y)) {
    sim.events.push({ type: 'plugMiss' })
    return false
  }
  cat.plugOut = false
  sim.chores.complete(PLUG_CHORE.id)
  s.hintsDone.plug = true
  sim.events.push({ type: 'plugFixed' })
  return true
}

/** Starts the next spring rain over the tub now, in the bathtub phase (dev and tests). */
export function triggerRain(sim: Sim): boolean {
  const s = sim.state
  if (s.containerIndex !== 2 || s.rain.stage !== 'dry') return false
  startRain(s.rain)
  sim.events.push({ type: 'rain', stage: 'start', gag: s.rain.gag })
  return true
}

/** In spring, rain comes through the skylight as you reach the house; always the first time. */
export function maybeRain(sim: Sim): void {
  const s = sim.state
  if (s.season !== 'spring' || s.rain.stage !== 'dry') return
  if (s.rain.count > 0 && sim.random() >= RAIN_CHANCE) return
  startRain(s.rain)
  sim.events.push({ type: 'rain', stage: 'start', gag: s.rain.gag })
}
