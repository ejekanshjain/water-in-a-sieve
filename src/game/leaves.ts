import type { Rng } from '../shared'
import { CRANK_LEAF_CHANCE, LEAF_SCOOP_CUT, MAX_WELL_LEAVES } from './tuning'

/**
 * A leaf floating in the well water. The game state owns where it rests, as a spot in
 * the unit disc of the pond, so the scene's physics can rebuild it after you leave.
 */
export interface Leaf {
  id: number
  /** Where it floats, in the unit disc: (0, 0) is the centre, 1 the water's edge. */
  u: number
  v: number
  angle: number
  /** Picks its colour and shape. */
  seed: number
}

/** What a scoop can hold with `leaves` floating in the water: 15% less for each leaf. */
export function leafCapacity(capacityMl: number, leaves: number): number {
  const clogged = Math.min(MAX_WELL_LEAVES, Math.max(0, leaves))
  return capacityMl * (1 - LEAF_SCOOP_CUT * clogged)
}

/**
 * Drops up to `count` leaves at random spots, never past MAX_WELL_LEAVES. Returns how many
 * landed. `nextId` gives the first id; the caller advances its counter by the result.
 */
export function scatterLeaves(
  leaves: Leaf[],
  count: number,
  random: Rng,
  nextId: number
): number {
  let added = 0
  while (added < count && leaves.length < MAX_WELL_LEAVES) {
    const a = random() * Math.PI * 2
    const r = 0.2 + random() * 0.5
    leaves.push({
      id: nextId + added,
      u: Math.cos(a) * r,
      v: Math.sin(a) * r,
      angle: random() * Math.PI * 2,
      seed: Math.floor(random() * 1000)
    })
    added++
  }
  return added
}

/** In autumn, how many leaves a crank brings up with the bucket: often 1 to 3, else none. */
export function crankLeaves(random: Rng): number {
  if (random() >= CRANK_LEAF_CHANCE) return 0
  return 1 + Math.floor(random() * MAX_WELL_LEAVES)
}
