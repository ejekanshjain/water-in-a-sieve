import Matter from 'matter-js'

import type { Leaf } from '../game/leaves'
import type { Sim } from '../game/sim'
import {
  CAM_X,
  CAM_Y,
  LEAF_HIT_RADIUS,
  LEAF_OUT_MARGIN,
  POND_RADIUS
} from '../game/tuning'
import { createPhysics, palette, stepPhysics } from '../shared'
import type { LeafArt } from './art/leaf'

/** A floating leaf's body, in logical units. */
const LEAF_W = 50
const LEAF_H = 26
/** The pond's wall: 8 static slabs, thick enough that nothing tunnels through. */
const WALLS = 8
const WALL_THICK = 30
const CAT_LEAF = 0x0002
const CAT_WALL = 0x0004
/** A new leaf drops in from above over this long. */
const DROP_IN_MS = 450
/** Slow currents keep floating leaves drifting: an acceleration per unit of mass. */
const CURRENT = 6e-5

/** What became of a leaf you let go of. */
export type LeafDrop = 'out' | 'back' | 'none'

/**
 * The well water seen from above, where autumn leaves float: a tiny Matter.js world with
 * no gravity, a ring of walls at the water's edge and at most 3 leaves (11 bodies). The
 * game state owns which leaves exist and where they rest; this world follows it, writes
 * positions back, and lets you drag a leaf out over the rim with a pointer constraint.
 */
export class LeafPond {
  private readonly engine = createPhysics({ gravity: 0 })
  private readonly bodies = new Map<number, Matter.Body>()
  /** Time since each leaf landed, for the drop-in. */
  private readonly ageMs = new Map<number, number>()
  private drag: { id: number; constraint: Matter.Constraint } | null = null
  private readonly seen = new Set<number>()
  private timeMs = 0
  /** Where the latest leaf left the water, for its flying-off effect. */
  readonly lastOut = { x: 0, y: 0 }

  constructor(
    private readonly sim: Sim,
    private readonly art: LeafArt
  ) {
    const reach = POND_RADIUS + WALL_THICK / 2
    const length = 2 * (POND_RADIUS + WALL_THICK) * Math.tan(Math.PI / WALLS)
    for (let i = 0; i < WALLS; i++) {
      const a = (i / WALLS) * Math.PI * 2
      const wall = Matter.Bodies.rectangle(
        CAM_X + Math.cos(a) * reach,
        CAM_Y + Math.sin(a) * reach,
        WALL_THICK,
        length,
        { isStatic: true, angle: a, collisionFilter: { category: CAT_WALL } }
      )
      Matter.Composite.add(this.engine.world, wall)
    }
  }

  /** Follows the game's leaves, drifts them on slow currents and saves where they rest. */
  update(dtMs: number): void {
    this.timeMs += dtMs
    this.sync()
    if (this.bodies.size === 0) return
    for (const [id, body] of this.bodies) {
      this.ageMs.set(id, (this.ageMs.get(id) ?? DROP_IN_MS) + dtMs)
      if (this.drag?.id === id) continue
      // A lazy swirl plus a wander, so they never sit perfectly still.
      const dx = body.position.x - CAM_X
      const dy = body.position.y - CAM_Y
      const r = Math.hypot(dx, dy) || 1
      const wander = Math.sin(this.timeMs / 900 + id * 2.1)
      const k = CURRENT * body.mass
      Matter.Body.applyForce(body, body.position, {
        x: k * (-dy / r + wander * 0.6),
        y: k * (dx / r + Math.cos(this.timeMs / 1100 + id) * 0.6)
      })
    }
    stepPhysics(this.engine, dtMs)
    for (const [id, body] of this.bodies)
      this.sim.placeLeaf(
        id,
        (body.position.x - CAM_X) / POND_RADIUS,
        (body.position.y - CAM_Y) / POND_RADIUS,
        body.angle
      )
  }

  /** The leaf under (x, y), topmost first, or -1. */
  hit(x: number, y: number): number {
    let best = -1
    let bestGap = LEAF_HIT_RADIUS
    for (const [id, body] of this.bodies) {
      const gap = Math.hypot(x - body.position.x, y - body.position.y)
      if (gap <= bestGap) {
        best = id
        bestGap = gap
      }
    }
    return best
  }

  /** Lifts a leaf off the water and starts dragging it toward (x, y). */
  grab(id: number, x: number, y: number): boolean {
    const body = this.bodies.get(id)
    if (!body || this.drag) return false
    body.collisionFilter.mask = CAT_LEAF
    const constraint = Matter.Constraint.create({
      pointA: { x, y },
      bodyB: body,
      pointB: { x: 0, y: 0 },
      stiffness: 0.2,
      damping: 0.1,
      length: 0
    })
    Matter.Composite.add(this.engine.world, constraint)
    this.drag = { id, constraint }
    return true
  }

  moveDrag(x: number, y: number): void {
    if (!this.drag) return
    this.drag.constraint.pointA.x = x
    this.drag.constraint.pointA.y = y
  }

  /**
   * Lets go of the dragged leaf. Past the water's edge it's out for good, if `clear` says
   * so; otherwise it drops back onto the water inside the wall.
   */
  release(clear: boolean): LeafDrop {
    const drag = this.drag
    if (!drag) return 'none'
    this.drag = null
    Matter.Composite.remove(this.engine.world, drag.constraint)
    const body = this.bodies.get(drag.id)
    if (!body) return 'none'
    const dx = body.position.x - CAM_X
    const dy = body.position.y - CAM_Y
    const r = Math.hypot(dx, dy)
    if (clear && r > POND_RADIUS + LEAF_OUT_MARGIN) {
      this.lastOut.x = body.position.x
      this.lastOut.y = body.position.y
      if (this.sim.removeLeaf(drag.id)) {
        this.removeBody(drag.id)
        return 'out'
      }
    }
    // Back on the water, clear of the wall.
    const inside = POND_RADIUS - LEAF_W / 2
    if (r > inside) {
      const k = inside / r
      Matter.Body.setPosition(body, { x: CAM_X + dx * k, y: CAM_Y + dy * k })
    }
    Matter.Body.setVelocity(body, { x: 0, y: 0 })
    body.collisionFilter.mask = CAT_LEAF | CAT_WALL
    return 'back'
  }

  /** True while a leaf is in your fingers. */
  get dragging(): boolean {
    return this.drag !== null
  }

  /** Draws the leaves on the water; `wet` darkens them while they cling to a dipped mesh. */
  drawFloating(ctx: CanvasRenderingContext2D, wet: boolean): void {
    for (const leaf of this.sim.state.well.leaves) {
      if (this.drag?.id === leaf.id) continue
      const body = this.bodies.get(leaf.id)
      const x = body ? body.position.x : CAM_X + leaf.u * POND_RADIUS
      const y = body ? body.position.y : CAM_Y + leaf.v * POND_RADIUS
      const angle = body ? body.angle : leaf.angle
      const t = Math.min(
        1,
        (this.ageMs.get(leaf.id) ?? DROP_IN_MS) / DROP_IN_MS
      )
      // Falling in from above: big and high, then a plop.
      const scale = 1 + (1 - t) * 0.9
      if (t < 1) {
        ctx.strokeStyle = palette.paper
        ctx.globalAlpha = t
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, 18 + t * 16, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      this.art.draw(ctx, x, y - (1 - t) * 60, angle, scale, leaf.seed)
      if (wet) {
        ctx.fillStyle = 'rgba(24, 100, 171, 0.25)'
        ctx.beginPath()
        ctx.ellipse(x, y, 22, 12, angle, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /** Draws the leaf in your fingers, lifted off the water with its shadow below. */
  drawHeld(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const drag = this.drag
    const body = drag ? this.bodies.get(drag.id) : undefined
    const leaf = drag ? this.find(drag.id) : null
    if (!body || !leaf) return
    const { x, y } = body.position
    ctx.fillStyle = 'rgba(30, 30, 30, 0.22)'
    ctx.beginPath()
    ctx.ellipse(x + 8, y + 14, 24, 10, body.angle, 0, Math.PI * 2)
    ctx.fill()
    const wiggle = Math.sin(timeMs / 90) * 0.12
    this.art.draw(ctx, x, y, body.angle + wiggle, 1.2, leaf.seed)
  }

  dispose(): void {
    Matter.Engine.clear(this.engine)
    this.bodies.clear()
  }

  /** Adds bodies for new leaves and removes bodies for leaves the game cleared. */
  private sync(): void {
    const leaves = this.sim.state.well.leaves
    this.seen.clear()
    for (const leaf of leaves) {
      this.seen.add(leaf.id)
      if (!this.bodies.has(leaf.id)) this.addBody(leaf)
    }
    for (const id of this.bodies.keys())
      if (!this.seen.has(id)) this.removeBody(id)
  }

  private addBody(leaf: Leaf): void {
    const body = Matter.Bodies.rectangle(
      CAM_X + leaf.u * POND_RADIUS,
      CAM_Y + leaf.v * POND_RADIUS,
      LEAF_W,
      LEAF_H,
      {
        angle: leaf.angle,
        chamfer: { radius: 11 },
        frictionAir: 0.08,
        restitution: 0.4,
        friction: 0.05,
        collisionFilter: { category: CAT_LEAF, mask: CAT_LEAF | CAT_WALL }
      }
    )
    Matter.Composite.add(this.engine.world, body)
    this.bodies.set(leaf.id, body)
    this.ageMs.set(leaf.id, 0)
  }

  private removeBody(id: number): void {
    const body = this.bodies.get(id)
    if (body) Matter.Composite.remove(this.engine.world, body)
    this.bodies.delete(id)
    this.ageMs.delete(id)
    if (this.drag?.id === id) {
      Matter.Composite.remove(this.engine.world, this.drag.constraint)
      this.drag = null
    }
  }

  private find(id: number): Leaf | null {
    for (const leaf of this.sim.state.well.leaves)
      if (leaf.id === id) return leaf
    return null
  }
}
