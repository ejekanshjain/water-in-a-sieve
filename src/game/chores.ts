import type { ChoreBoard } from '../shared'
import {
  CHORE_ESTIMATE_S,
  DIRECTOR_COVER,
  HOUSE_WALK_S,
  TRIP_WALK_S
} from './tuning'
import type { Patch } from './path'
import type { Season } from './types'

/** Chores the director can hand out, with their estimated seconds in CHORE_ESTIMATE_S. */
export type ChoreKind = keyof typeof CHORE_ESTIMATE_S

/** The frog sits on the crank and blocks it. */
export const FROG_CHORE = {
  id: 'frog',
  label: 'Move the frog',
  detail: 'It sits on the crank handle.',
  blocks: ['crank']
} as const

/** Holes block scooping until they're sewn shut at the bench. */
export const MEND_CHORE = {
  id: 'mend',
  label: 'Mend the sieve',
  detail: 'Sew the holes shut at the bench.',
  blocks: ['scoop']
} as const

/** A wet patch on the house floor, from a splashy pour or the director's wet step. */
export const WIPE_FLOOR_CHORE = {
  id: 'wipe',
  label: 'Wipe the house floor',
  detail: 'Rub the puddle dry on a house visit.'
} as const

/** Autumn leaves floating in the well water; each one cuts every scoop by 15%. */
export const LEAVES_CHORE = {
  id: 'leaves',
  label: 'Clear the leaves',
  detail: 'Drag them out of the well water at the well.'
} as const

/** The cat drinks from the container you're filling until you shoo it. */
export const CAT_CHORE = {
  id: 'cat',
  label: 'Shoo the cat',
  detail: "It's drinking your water. Go to the house and shoo it."
} as const

/** The cat pulled the bathtub plug; the tub drains until you put it back. */
export const PLUG_CHORE = {
  id: 'plug',
  label: 'Check the plug',
  detail: 'The tub is draining. Go to the house and drag the plug back in.'
} as const

/** The wax wore off, or soon will: rub it back on at the bench. */
export const REWAX_CHORE = {
  id: 'rewax',
  label: 'Rewax the sieve',
  detail: 'Use the wax tin by the well, then rub.'
} as const

/** Soaked slippers want an hour on the line. Well, a minute. */
export const SLIPPERS_CHORE = {
  id: 'slippers',
  label: 'Dry your slippers',
  detail: 'Hang them on the washing line at the well.'
} as const

/** A path patch you walked past without wiping. Stop on it during an empty walk. */
export function patchChore(patch: Patch): {
  id: string
  label: string
  detail: string
} {
  const at = `${Math.round(patch.at)} m`
  const label =
    patch.kind === 'ice'
      ? `Scrape the ice at ${at}`
      : patch.kind === 'leaves'
        ? `Sweep the leaves at ${at}`
        : `Wipe the puddle at ${at}`
  return {
    id: `patch-${patch.id}`,
    label,
    detail: 'Stop on it on an empty walk and rub.'
  }
}

/** Moments the director looks at the waits. */
export type DirectorMoment =
  /** The fifth scoop just started a refill; you're carrying to the house. */
  | 'refillStart'
  /** You reached the house with a wait still running. */
  | 'houseArrive'
  /** You reached the well with the refill still running. */
  | 'refillArrive'
  /** Glue started drying, or you reached the well while it dries. */
  | 'glueStart'

/** What the director needs to know to pick chores. */
export interface DirectorContext {
  season: Season
  /** Chores built so far that can open now. Later milestones add theirs. */
  available: ReadonlySet<ChoreKind>
  /**
   * This refill's house chore is the cat rather than the wet floor. The sim rolls it on
   * DIRECTOR_CAT_SHARE of refills, so the cat stays a surprise. False when left out.
   */
  catFirst?: boolean
}

/**
 * Candidate chores per moment, first eligible first. The frog is the fallback at the
 * well, so a wait there always has something to do.
 */
function candidates(moment: DirectorMoment, ctx: DirectorContext): ChoreKind[] {
  const autumn = ctx.season === 'autumn'
  switch (moment) {
    case 'refillStart':
      return ctx.catFirst ? ['cat', 'wipe', 'frog'] : ['wipe', 'cat', 'frog']
    case 'houseArrive':
      return ctx.catFirst ? ['cat', 'wipe'] : ['wipe', 'cat']
    case 'refillArrive':
      // Back early from a trip that drained: the house has work too.
      return autumn
        ? ['rewax', 'leaves', 'frog', 'wipe', 'cat', 'plug']
        : ['rewax', 'frog', 'wipe', 'cat', 'plug']
    case 'glueStart':
      return autumn
        ? ['rewax', 'leaves', 'cat', 'wipe', 'plug', 'frog']
        : ['rewax', 'cat', 'wipe', 'plug', 'frog']
  }
}

/**
 * Walking that already fills part of the wait at this moment, in seconds: the rest of the
 * trip after a refill starts, and the run back to the well from the house.
 */
function walkingSeconds(moment: DirectorMoment): number {
  if (moment === 'refillStart') return TRIP_WALK_S
  return moment === 'houseArrive' ? HOUSE_WALK_S : 0
}

/** Seconds a chore takes, including the walk to the house and back for house chores. */
export function choreSeconds(kind: ChoreKind): number {
  const house = kind === 'cat' || kind === 'plug' || kind === 'wipe'
  return CHORE_ESTIMATE_S[kind] + (house ? HOUSE_WALK_S * 2 : 0)
}

/** Seconds of work the open chores add up to. */
export function coveredSeconds(board: ChoreBoard): number {
  let total = 0
  for (const chore of board.list()) {
    if (chore.id in CHORE_ESTIMATE_S)
      total += choreSeconds(chore.id as ChoreKind)
    // Path patches you walked past get wiped on the way, with no extra walk.
    else if (chore.id.startsWith('patch-')) total += CHORE_ESTIMATE_S.wipe
  }
  return total
}

/**
 * The chores to open now so open chores plus walking cover at least DIRECTOR_COVER of the
 * wait. It adds eligible candidates in order until the wait is covered or none are left.
 * The sim only asks on arrival when at least DIRECTOR_MIN_LEFT_S remain.
 */
export function directorPicks(
  moment: DirectorMoment,
  board: ChoreBoard,
  waitLeftS: number,
  ctx: DirectorContext
): ChoreKind[] {
  const want = DIRECTOR_COVER * waitLeftS
  let covered = coveredSeconds(board) + walkingSeconds(moment)
  const picks: ChoreKind[] = []
  for (const kind of candidates(moment, ctx)) {
    if (covered >= want) break
    if (!ctx.available.has(kind) || board.has(kind)) continue
    picks.push(kind)
    covered += choreSeconds(kind)
  }
  return picks
}

/** Share of the wait that open chores plus walking cover now, 0 to 1 and beyond. */
export function coverage(
  moment: DirectorMoment,
  board: ChoreBoard,
  waitLeftS: number
): number {
  if (waitLeftS <= 0) return 1
  return (coveredSeconds(board) + walkingSeconds(moment)) / waitLeftS
}
