import type { Rng } from '../shared'
import { HOLE_LEAK_ML_PER_S, MAX_HOLES } from './tuning'

/** A hole torn in the mesh. It leaks while you carry and blocks scooping until sewn. */
export interface Hole {
  id: number
  /** Where it sits on the mesh: an angle in radians and a distance from the centre (0 to 1). */
  angle: number
  dist: number
  /** Picks its jagged outline. */
  seed: number
  /** Stitch points needed to sew it shut, and how many are sewn. */
  points: number
  stitched: number
}

/** Holes keep at least this far apart, as a share of the mesh radius, so stitches never overlap. */
const MIN_GAP = 0.75

/** Distance between two holes as a share of the mesh radius. */
function gap(a: Pick<Hole, 'angle' | 'dist'>, b: Hole): number {
  const dx = Math.cos(a.angle) * a.dist - Math.cos(b.angle) * b.dist
  const dy = Math.sin(a.angle) * a.dist - Math.sin(b.angle) * b.dist
  return Math.hypot(dx, dy)
}

/** Tears a new hole at a random free spot, unless the mesh already has MAX_HOLES. */
export function tearHole(holes: Hole[], random: Rng, id: number): Hole | null {
  if (holes.length >= MAX_HOLES) return null
  let spot = { angle: 0, dist: 0 }
  for (let tries = 0; tries < 12; tries++) {
    spot = { angle: random() * Math.PI * 2, dist: 0.3 + random() * 0.4 }
    if (holes.every(h => gap(spot, h) >= MIN_GAP)) break
  }
  const hole: Hole = {
    id,
    angle: spot.angle,
    dist: spot.dist,
    seed: Math.floor(random() * 1000),
    points: 4 + Math.floor(random() * 3),
    stitched: 0
  }
  holes.push(hole)
  return hole
}

/** mL per second leaking through `count` holes. */
export function holeLeakRate(count: number): number {
  return Math.min(count, MAX_HOLES) * HOLE_LEAK_ML_PER_S
}
