import { startTimer, type Rng, type UpgradeDef } from '../shared'
import { FROG_CHORE, REWAX_CHORE, SLIPPERS_CHORE } from './chores'
import type { Sim } from './sim'
import { capacityMl } from './sieve'
import {
  BIG_SIEVE_WEIGHT,
  BIGGER_SIEVE_COST,
  FINER_MESH_COST,
  HAT_COST,
  PAVED_PATH_COST,
  REWAX_DUE_TRIPS,
  REWAX_STROKES,
  SLIPPER_GAIT,
  SLIPPERS_COST,
  SLIPPERS_DRY_MS,
  STONES,
  SWATTER_COST,
  TREAT_TRIPS,
  TREATS_COST,
  WAX_COST,
  WAX_TRIPS,
  WISH_COST,
  WISH_FROG_ODDS
} from './tuning'

/** Upgrades in the shop. */
export type UpgradeId =
  'wax' | 'slippers' | 'swatter' | 'finerMesh' | 'pavedPath' | 'biggerSieve'

export interface SieveUpgrade extends UpgradeDef {
  id: UpgradeId
}

/** The shop's upgrades, cheapest first. ShopPanel shows `helps` and `newChore` as written. */
export const UPGRADES: readonly SieveUpgrade[] = [
  {
    id: 'wax',
    name: 'Wax Coating',
    cost: WAX_COST,
    helps: 'Cuts drips, leaks and slosh by 65%.',
    newChore: 'Rewax it every 10 trips.'
  },
  {
    id: 'slippers',
    name: 'Slippers',
    cost: SLIPPERS_COST,
    helps: 'Softer, quieter steps. You slip less.',
    newChore: 'Spills soak them. Dry them on the line.'
  },
  {
    id: 'swatter',
    name: 'Fly Swatter',
    cost: SWATTER_COST,
    helps: 'One swat kills a fly or a falling leaf.',
    newChore: 'Every swing shakes the sieve.'
  },
  {
    id: 'finerMesh',
    name: 'Finer Mesh',
    cost: FINER_MESH_COST,
    helps: 'Holds 0.5 L more and drips 30% less.',
    newChore: 'It fills slowly. Dip for 3 seconds.'
  },
  {
    id: 'pavedPath',
    name: 'Paved Path',
    cost: PAVED_PATH_COST,
    helps: 'Each stone flattens the bumps in its 5 m.',
    newChore: `Lay ${STONES} stones yourself, one per empty walk.`
  },
  {
    id: 'biggerSieve',
    name: 'Bigger Sieve',
    cost: BIGGER_SIEVE_COST,
    helps: 'Carries twice the water.',
    newChore: `Twice the weight. Every wobble counts ${Math.round((BIG_SIEVE_WEIGHT - 1) * 100)}% more.`
  }
]

/** Things to spend coins on once the upgrades run out. */
export type JokeId = 'wish' | 'treats' | 'hat'

export interface JokeBuy {
  id: JokeId
  name: string
  cost: number
  blurb: string
}

export const JOKE_BUYS: readonly JokeBuy[] = [
  {
    id: 'wish',
    name: 'Wish at the Well',
    cost: WISH_COST,
    blurb: 'Toss a coin in. Only works at the well.'
  },
  {
    id: 'treats',
    name: 'Cat Treats',
    cost: TREATS_COST,
    blurb: `The cat eats these instead of your water, for ${TREAT_TRIPS} trips.`
  },
  {
    id: 'hat',
    name: 'Party Hat',
    cost: HAT_COST,
    blurb: 'Does nothing. You wear it everywhere.'
  }
]

/** Your slippers: none yet, on your feet, soaked through, or on the washing line. */
export type SlipperState = 'none' | 'dry' | 'soaked' | 'drying'

/** What you own beyond the sieve, and its upkeep. */
export interface KitState {
  /** You bought Wax Coating, worn off or not. */
  wax: boolean
  /** Trips of wax left; the wax wears off when this reaches 0. */
  waxTripsLeft: number
  /** Rub strokes done toward the rewax at the bench. */
  waxRubbed: number
  slippers: SlipperState
  swatter: boolean
  /** A swatter swing in progress, counting down in ms. */
  swingMs: number
  /** A Swat button press, waiting for the next step. */
  swatQueued: boolean
  /** Trips the cat stays busy with treats. */
  treatTrips: number
  hat: boolean
  wishes: number
  /** Paving stones still in the pile. */
  stonesLeft: number
}

export function createKit(): KitState {
  return {
    wax: false,
    waxTripsLeft: 0,
    waxRubbed: 0,
    slippers: 'none',
    swatter: false,
    swingMs: 0,
    swatQueued: false,
    treatTrips: 0,
    hat: false,
    wishes: 0,
    stonesLeft: 0
  }
}

/** Dry slippers smooth out your steps; soaked ones don't. */
export function gaitScale(slippers: SlipperState): number {
  return slippers === 'dry' ? SLIPPER_GAIT : 1
}

/** What the well says to a coin. */
export const WISH_LINES: readonly string[] = [
  'You wish for running water. The well hears "running".',
  'You wish for a bucket. You have a bucket.',
  'You wish for a better sieve. No refunds.',
  'Plop. A distant flush. Not yours.',
  'You wish the interview goes well. The well says nothing.',
  'You wish for no flies. A fly hears you.',
  'Plop. Somewhere, a duck squeaks.'
]

/** The line the frog gets: it hops out of the well and back onto your crank. */
export const WISH_FROG_LINE = 'Plop. Ribbit. Wish granted, sort of.'

/** A wish's outcome: one in WISH_FROG_ODDS brings the frog back. */
export function rollWish(random: Rng): { line: string; frog: boolean } {
  if (random() * WISH_FROG_ODDS < 1) return { line: WISH_FROG_LINE, frog: true }
  const index = Math.floor(random() * WISH_LINES.length)
  return { line: WISH_LINES[index] ?? 'Plop.', frog: false }
}

/** Why a joke buy can't happen now: owned (the hat), not here (a wish away from the well), or poor. */
export type JokeBlocker = 'owned' | 'notHere' | 'poor'

/** Why a joke buy can't happen now, or null. */
export function jokeBlocker(sim: Sim, id: JokeId): JokeBlocker | null {
  const s = sim.state
  const item = JOKE_BUYS.find(j => j.id === id)
  if (!item || (id === 'hat' && s.kit.hat)) return 'owned'
  if (id === 'wish' && s.scene !== 'well') return 'notHere'
  return sim.wallet.canAfford(item.cost) ? null : 'poor'
}

// ---------------------------------------------------------------- Sim actions

/** Applies an upgrade the shop just sold you. */
export function applyUpgrade(sim: Sim, id: UpgradeId): void {
  const s = sim.state
  if (id === 'wax') {
    s.kit.wax = true
    s.gear.wax = true
    s.kit.waxTripsLeft = WAX_TRIPS
  } else if (id === 'slippers') {
    s.kit.slippers = 'dry'
  } else if (id === 'swatter') {
    s.kit.swatter = true
  } else if (id === 'pavedPath') {
    s.kit.stonesLeft = STONES
  } else {
    if (id === 'finerMesh') s.gear.finerMesh = true
    else s.gear.biggerSieve = true
    s.capacityMl = capacityMl(s.gear)
  }
  sim.events.push({ type: 'upgrade', id })
}

/** Pays for a joke buy and plays it out. Returns its line for a toast, or null. */
export function buyJoke(sim: Sim, id: JokeId): string | null {
  const s = sim.state
  const item = JOKE_BUYS.find(j => j.id === id)
  if (!item || jokeBlocker(sim, id) !== null) return null
  sim.wallet.spend(item.cost, item.name)
  if (id === 'wish') {
    s.kit.wishes++
    const wish = rollWish(sim.random)
    const frog = wish.frog && s.well.frog === 'none'
    if (frog) {
      s.well.frog = 'on'
      s.well.frogMoves = 0
      sim.chores.add(FROG_CHORE)
    }
    sim.events.push({ type: 'wish', frog })
    return wish.frog && !frog
      ? 'Ribbit. The frog waves from your crank.'
      : wish.line
  }
  if (id === 'treats') {
    s.kit.treatTrips += TREAT_TRIPS
    // It smells the bag and leaves your water for the treats.
    const drinking = s.cat.mood === 'drinking'
    if (drinking) {
      s.cat.mood = 'away'
      sim.chores.complete('cat')
    }
    sim.events.push({ type: 'treats' })
    return drinking
      ? 'The cat drops your water for the treats.'
      : `The cat is busy for ${s.kit.treatTrips} trips.`
  }
  s.kit.hat = true
  sim.events.push({ type: 'hat' })
  return 'You look great. It does nothing.'
}

/** True while the wax wants rubbing back on: worn off, or due within a few trips. */
export function rewaxDue(sim: Sim): boolean {
  const s = sim.state
  return s.kit.wax && s.kit.waxTripsLeft <= REWAX_DUE_TRIPS
}

/** A trip just started: a waxed sieve uses up one trip of wax. */
export function useWax(sim: Sim): void {
  const s = sim.state
  if (s.gear.wax && s.kit.waxTripsLeft > 0) s.kit.waxTripsLeft--
}

/** A trip ended: wax with no trips left wears off, and rewaxing becomes a chore. */
export function wearWax(sim: Sim): void {
  const s = sim.state
  if (!s.gear.wax || s.kit.waxTripsLeft > 0) return
  s.gear.wax = false
  sim.chores.add(REWAX_CHORE)
  sim.events.push({ type: 'waxWorn' })
}

/** Rub strokes with the wax block at the bench. Returns true once the wax is back on. */
export function rubWax(sim: Sim, strokes: number): boolean {
  const s = sim.state
  const kit = s.kit
  if (!s.bench.open || s.bench.mode !== 'wax' || s.paused) return false
  kit.waxRubbed = Math.min(REWAX_STROKES, kit.waxRubbed + strokes)
  sim.events.push({ type: 'waxRub', progress: kit.waxRubbed / REWAX_STROKES })
  if (kit.waxRubbed < REWAX_STROKES) return false
  kit.waxRubbed = 0
  kit.waxTripsLeft = WAX_TRIPS
  s.gear.wax = true
  s.hintsDone.rewax = true
  sim.chores.complete(REWAX_CHORE.id)
  sim.events.push({ type: 'waxed' })
  return true
}

/** Water landed on your feet: dry slippers soak through and want drying. */
export function soakSlippers(sim: Sim): void {
  const kit = sim.state.kit
  if (kit.slippers !== 'dry') return
  kit.slippers = 'soaked'
  sim.chores.add(SLIPPERS_CHORE)
  sim.events.push({ type: 'slippersSoaked' })
}

/** True while soaked slippers can go on the washing line: at the well, hands free. */
export function canHangSlippers(sim: Sim): boolean {
  const s = sim.state
  return (
    s.kit.slippers === 'soaked' &&
    s.scene === 'well' &&
    !s.paused &&
    s.holdStillMs <= 0 &&
    !s.bench.open
  )
}

/** Hangs soaked slippers on the line. You go barefoot while they dry. */
export function hangSlippers(sim: Sim): boolean {
  const s = sim.state
  if (!canHangSlippers(sim)) return false
  s.kit.slippers = 'drying'
  s.waits.slippers = startTimer('Slippers drying', SLIPPERS_DRY_MS, sim.now())
  s.hintsDone.slippers = true
  sim.chores.complete(SLIPPERS_CHORE.id)
  sim.events.push({ type: 'slippersHung' })
  return true
}
