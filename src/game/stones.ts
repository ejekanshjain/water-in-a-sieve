import { firstUnpaved, flattenBumps, segmentAhead, segmentMiddle } from './path'
import type { GameState, Sim } from './sim'
import {
  GROUND_Y,
  HERO_X_BACK,
  HERO_X_OUT,
  PATH_METRES,
  STONE_FIT_RADIUS,
  STONE_PROMPT_M,
  STONE_STAGE_M,
  UNITS_PER_METRE,
  WIPE_STOP_SPEED
} from './tuning'

/**
 * Paved Path: one stone per empty walk, for the first unpaved segment the walk reaches.
 * Pass it and the chance is gone until the next walk; skipping costs nothing.
 */
export interface StoneWalk {
  /** The segment this walk can pave, or -1 once laid, passed, or out of stones. */
  segment: number
  /** The stone is out beside you and its slot shows on the path: drag it in. */
  placing: boolean
  /** The stone is in your fingers at (x, y). */
  held: boolean
  x: number
  y: number
}

export function createStoneWalk(): StoneWalk {
  return { segment: -1, placing: false, held: false, x: 0, y: 0 }
}

/** An empty walk starts: it may pave the first unpaved segment it reaches. */
export function startStoneWalk(sim: Sim): void {
  const s = sim.state
  const stone = s.stone
  stone.placing = false
  stone.held = false
  stone.segment =
    s.kit.stonesLeft > 0
      ? firstUnpaved(s.path, s.walker.distance, s.walker.dir)
      : -1
}

/** True while the Lay Stone prompt shows: the walk's segment is just ahead or underfoot. */
export function stonePrompt(state: GameState): boolean {
  const stone = state.stone
  if (stone.segment < 0 || stone.placing) return false
  const ahead = segmentAhead(
    stone.segment,
    state.walker.distance,
    state.walker.dir
  )
  return ahead >= 0 && ahead <= STONE_PROMPT_M
}

/**
 * One step of an empty walk: walking past the segment ends the chance; stopping by it,
 * after walking a little, gets the stone out.
 */
export function stepStoneWalk(sim: Sim, running: boolean): void {
  const s = sim.state
  const stone = s.stone
  if (stone.segment < 0 || stone.placing) return
  const ahead = segmentAhead(stone.segment, s.walker.distance, s.walker.dir)
  if (ahead < 0) {
    stone.segment = -1
    return
  }
  const stopped = !running && s.walker.speed < WIPE_STOP_SPEED
  if (stopped && s.walker.steps > 0 && ahead <= STONE_PROMPT_M) openStone(sim)
}

/** Gets the stone out: you stand a few steps short of the segment, its slot ahead of you. */
export function openStone(sim: Sim): boolean {
  const s = sim.state
  const stone = s.stone
  if (stone.segment < 0 || stone.placing || s.kit.stonesLeft <= 0) return false
  const middle = segmentMiddle(stone.segment)
  const at = middle - s.walker.dir * STONE_STAGE_M
  s.walker.distance = Math.max(0, Math.min(PATH_METRES, at))
  s.walker.speed = 0
  stone.placing = true
  stone.held = false
  sim.events.push({ type: 'stoneOut' })
  return true
}

/** Where the stone's slot sits on the walk strip, in logical units. */
export function stoneSlot(
  state: GameState,
  out: { x: number; y: number }
): { x: number; y: number } {
  const heroX = state.walker.dir < 0 ? HERO_X_BACK : HERO_X_OUT
  const middle = segmentMiddle(state.stone.segment)
  out.x = heroX + (middle - state.walker.distance) * UNITS_PER_METRE
  out.y = GROUND_Y + 12
  return out
}

/** Where the stone waits beside your feet until you pick it up. */
export function stoneRest(
  state: GameState,
  out: { x: number; y: number }
): { x: number; y: number } {
  const heroX = state.walker.dir < 0 ? HERO_X_BACK : HERO_X_OUT
  out.x = heroX - state.walker.dir * 46
  out.y = GROUND_Y + 10
  return out
}

/** The stone follows your pointer. */
export function dragStone(sim: Sim, x: number, y: number): void {
  const stone = sim.state.stone
  if (!stone.placing || sim.state.paused) return
  stone.held = true
  stone.x = x
  stone.y = y
}

const slot = { x: 0, y: 0 }

/** Drops the stone: in its slot it's laid, anywhere else it goes back by your feet. */
export function dropStone(sim: Sim, x: number, y: number): boolean {
  const s = sim.state
  const stone = s.stone
  if (!stone.held) return false
  stone.held = false
  stoneSlot(s, slot)
  if (!stone.placing || Math.hypot(x - slot.x, y - slot.y) > STONE_FIT_RADIUS)
    return false
  return layStone(sim)
}

/** Lays the walk's stone in its segment: its bumps are gone and steps there are softer. */
export function layStone(sim: Sim): boolean {
  const s = sim.state
  const stone = s.stone
  if (!stone.placing || stone.segment < 0 || s.kit.stonesLeft <= 0) return false
  s.path.stones[stone.segment] = true
  s.kit.stonesLeft--
  s.hintsDone.stone = true
  sim.events.push({
    type: 'stoneLaid',
    segment: stone.segment,
    left: s.kit.stonesLeft,
    flattened: flattenBumps(s.path, stone.segment)
  })
  stone.segment = -1
  stone.placing = false
  stone.held = false
  return true
}

/** Walking off puts the stone back by your feet; the chance passes with the segment. */
export function putStoneAway(sim: Sim): void {
  const stone = sim.state.stone
  stone.placing = false
  stone.held = false
}
