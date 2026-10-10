import {
  BUCKET_DONE_MS,
  CAT_GAG_MS,
  COLD_OPEN_MS,
  DUCK_GAG_MS,
  ENDING_MS,
  RESCHEDULE_GAG_MS,
  SINK_DONE_MS,
  TUB_MILESTONES_ML
} from './tuning'
import type { CutsceneId } from './types'

/** How long a cutscene runs, and where play picks up after it. */
export interface CutsceneDef {
  ms: number
  /**
   * `well`: back at the well with an empty sieve. `walkBack`: run home from the house.
   * `end`: the game is over, and the ending screen shows over the last frame.
   */
  then: 'well' | 'walkBack' | 'end'
}

export const CUTSCENES: Record<CutsceneId, CutsceneDef> = {
  coldOpen: { ms: COLD_OPEN_MS, then: 'well' },
  bucketDone: { ms: BUCKET_DONE_MS, then: 'well' },
  sinkDone: { ms: SINK_DONE_MS, then: 'well' },
  duck: { ms: DUCK_GAG_MS, then: 'walkBack' },
  catTest: { ms: CAT_GAG_MS, then: 'walkBack' },
  reschedule: { ms: RESCHEDULE_GAG_MS, then: 'walkBack' },
  ending: { ms: ENDING_MS, then: 'end' }
}

/** The cutscene for finishing each container, by index. The bathtub's is the ending. */
export const CONTAINER_DONE: readonly (CutsceneId | null)[] = [
  'bucketDone',
  'sinkDone',
  'ending'
]

/** The gag for each bathtub milestone, in the order of TUB_MILESTONES_ML. */
const MILESTONE_GAGS: readonly CutsceneId[] = ['duck', 'catTest', 'reschedule']

/** Each milestone gag's caption, in the same order. Its share card uses it as the title. */
export const MILESTONE_LINES: readonly string[] = [
  '25 L. The duck floats.',
  '50 L. The cat tests the water.',
  '75 L. They pushed it to 10.'
]

export function isCutscene(phase: string): phase is CutsceneId {
  return phase in CUTSCENES
}

/** How many bathtub milestones `ml` has passed. */
export function milestonesPassed(ml: number): number {
  let passed = 0
  for (const at of TUB_MILESTONES_ML) if (ml >= at) passed++
  return passed
}

/**
 * The gag to play after a pour, or null. Only milestones not shown yet count, and when a
 * pour passes two at once only the highest plays.
 */
export function milestoneGag(shown: number, ml: number): CutsceneId | null {
  const passed = milestonesPassed(ml)
  return passed > shown ? (MILESTONE_GAGS[passed - 1] ?? null) : null
}
