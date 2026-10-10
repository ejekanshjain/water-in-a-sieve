import Matter from 'matter-js'

import { GROUND_Y } from '../game/tuning'
import {
  createPhysics,
  palette,
  sketchEllipse,
  sketchPolygon,
  sketchRoundRect,
  stepPhysics,
  type SketchStyle
} from '../shared'

/** How long a tumbling sieve stays on screen. */
const TUMBLE_MS = 1600
/** A kicked bucket stays until its cutscene shuts the shed door. */
const KICK_MS = 4000
/** Bucket half widths at the top and bottom, and its height. */
const BUCKET_TOP = 30
const BUCKET_BOTTOM = 23
const BUCKET_HEIGHT = 44

/**
 * One small Matter.js world for cosmetic tumbles: the sieve flying out of your hands on
 * a slip, and the empty bucket kicked into the shed. It never touches game state, and it
 * holds at most 3 bodies. Step it with simulation time.
 */
export class Tumbles {
  private readonly engine = createPhysics({ gravity: 1 })
  private body: Matter.Body | null = null
  private kind: 'sieve' | 'bucket' = 'sieve'
  /** The shed's back wall, there only while a bucket flies. */
  private wall: Matter.Body | null = null
  private msLeft = 0

  constructor() {
    // A thick floor, so a fast body can't pass through it.
    const ground = Matter.Bodies.rectangle(0, GROUND_Y + 40, 8000, 80, {
      isStatic: true,
      friction: 0.8
    })
    Matter.Composite.add(this.engine.world, ground)
  }

  /** Throws the sieve from (x, y) with a spin. Velocities are in units per second. */
  throwSieve(x: number, y: number, vx: number, vy: number): void {
    this.clear()
    const body = Matter.Bodies.circle(x, y, 26, {
      restitution: 0.45,
      friction: 0.6,
      frictionAir: 0.01
    })
    this.launch(body, 'sieve', vx, vy, 0.25, TUMBLE_MS)
  }

  /**
   * Kicks the empty bucket from (x, y) toward a wall at `wallX`, such as the back of the
   * shed, so it clatters in and stays there.
   */
  kickBucket(
    x: number,
    y: number,
    vx: number,
    vy: number,
    wallX: number
  ): void {
    this.clear()
    const body = Matter.Bodies.rectangle(
      x,
      y,
      BUCKET_TOP + BUCKET_BOTTOM,
      BUCKET_HEIGHT,
      { restitution: 0.3, friction: 0.7, frictionAir: 0.005 }
    )
    this.wall = Matter.Bodies.rectangle(wallX + 40, GROUND_Y - 200, 80, 400, {
      isStatic: true
    })
    Matter.Composite.add(this.engine.world, this.wall)
    this.launch(body, 'bucket', vx, vy, 0.35, KICK_MS)
  }

  update(dtMs: number): void {
    if (!this.body) return
    stepPhysics(this.engine, dtMs)
    this.msLeft -= dtMs
    if (this.msLeft <= 0) this.clear()
  }

  /** True while something is tumbling. */
  get active(): boolean {
    return this.body !== null
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const body = this.body
    if (!body) return
    ctx.save()
    ctx.translate(body.position.x, body.position.y)
    ctx.rotate(body.angle)
    if (this.kind === 'bucket') {
      drawBucket(ctx)
    } else {
      ctx.globalAlpha = Math.min(1, this.msLeft / 300)
      sketchEllipse(ctx, 0, 4, 40, 9, MESH)
      sketchEllipse(ctx, 0, 0, 42, 8, RIM)
    }
    ctx.restore()
  }

  /** Removes whatever is tumbling, for example when a door shuts on it. */
  clear(): void {
    if (this.body) Matter.Composite.remove(this.engine.world, this.body)
    if (this.wall) Matter.Composite.remove(this.engine.world, this.wall)
    this.body = null
    this.wall = null
  }

  dispose(): void {
    this.clear()
    Matter.Engine.clear(this.engine)
  }

  private launch(
    body: Matter.Body,
    kind: 'sieve' | 'bucket',
    vx: number,
    vy: number,
    spin: number,
    ms: number
  ): void {
    // Matter velocities are per 16.7 ms step.
    Matter.Body.setVelocity(body, { x: vx / 60, y: vy / 60 })
    Matter.Body.setAngularVelocity(body, spin)
    Matter.Composite.add(this.engine.world, body)
    this.body = body
    this.kind = kind
    this.msLeft = ms
  }
}

const MESH = {
  fill: 'rgba(120,120,120,0.35)',
  fillStyle: 'hatch' as const,
  hatchGap: 5,
  color: palette.inkSoft,
  width: 1.5,
  wobble: 1,
  seed: 140
}
const RIM = { color: '#9a6a3a', width: 5, wobble: 1.5, seed: 141 }
const BUCKET: SketchStyle = {
  fill: '#9aa5ad',
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  wobble: 1.5,
  seed: 142
}
const bucketPoints = new Float64Array([
  -BUCKET_TOP,
  -BUCKET_HEIGHT / 2,
  BUCKET_TOP,
  -BUCKET_HEIGHT / 2,
  BUCKET_BOTTOM,
  BUCKET_HEIGHT / 2,
  -BUCKET_BOTTOM,
  BUCKET_HEIGHT / 2
])

/** The empty bucket centred on (0, 0), opening up. Cutscenes draw it before the kick. */
export function drawBucket(ctx: CanvasRenderingContext2D): void {
  sketchPolygon(ctx, bucketPoints, BUCKET)
  sketchEllipse(ctx, 0, -BUCKET_HEIGHT / 2, BUCKET_TOP, 6, {
    color: palette.ink,
    width: 2.5,
    seed: 143
  })
}

/** How long knocked-over things lie on the floor before they fade. */
const KNOCK_MS = 2600
/** A shooed cat sends this much flying. */
const KNOCK_COUNT = 3

/** The things a leaping cat knocks over, by room: half sizes and colours. */
const KNOCKABLES = {
  step: [
    { w: 12, h: 14, fill: '#c46b3c' },
    { w: 6, h: 18, fill: palette.green },
    { w: 10, h: 10, fill: palette.yellow }
  ],
  kitchen: [
    { w: 18, h: 4, fill: '#f4f1ea' },
    { w: 9, h: 11, fill: palette.blue },
    { w: 18, h: 4, fill: '#f4f1ea' }
  ],
  bathroom: [
    { w: 7, h: 17, fill: palette.pink },
    { w: 9, h: 11, fill: palette.water },
    { w: 11, h: 6, fill: palette.yellow }
  ]
} as const

/**
 * A shooed cat's leap knocks a few things off the container's rim: a cosmetic Matter.js
 * world with a floor and at most 3 bodies, stepped with simulation time.
 */
export class Knocks {
  private readonly engine = createPhysics({ gravity: 1 })
  private readonly bodies: Matter.Body[] = []
  private readonly items: (typeof KNOCKABLES)[keyof typeof KNOCKABLES][number][] =
    []
  private msLeft = 0

  constructor() {
    const ground = Matter.Bodies.rectangle(0, GROUND_Y + 40, 8000, 80, {
      isStatic: true,
      friction: 0.8
    })
    Matter.Composite.add(this.engine.world, ground)
  }

  /** Sends the room's things flying from (x, y), up and out to both sides. */
  knock(room: keyof typeof KNOCKABLES, x: number, y: number): void {
    this.clear()
    const items = KNOCKABLES[room]
    for (let i = 0; i < KNOCK_COUNT; i++) {
      const item = items[i % items.length]
      if (!item) continue
      const body = Matter.Bodies.rectangle(
        x - 20 + i * 18,
        y - 12,
        item.w * 2,
        item.h * 2,
        { restitution: 0.35, friction: 0.6, frictionAir: 0.01 }
      )
      // Matter velocities are per 16.7 ms step.
      Matter.Body.setVelocity(body, {
        x: (-120 + i * 150) / 60,
        y: (-440 + i * 40) / 60
      })
      Matter.Body.setAngularVelocity(body, 0.15 + i * 0.1)
      Matter.Composite.add(this.engine.world, body)
      this.bodies.push(body)
      this.items.push(item)
    }
    this.msLeft = KNOCK_MS
  }

  update(dtMs: number): void {
    if (this.bodies.length === 0) return
    stepPhysics(this.engine, dtMs)
    this.msLeft -= dtMs
    if (this.msLeft <= 0) this.clear()
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.bodies.length === 0) return
    ctx.globalAlpha = Math.min(1, this.msLeft / 400)
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i]
      const item = this.items[i]
      if (!body || !item) continue
      ctx.save()
      ctx.translate(body.position.x, body.position.y)
      ctx.rotate(body.angle)
      KNOCKED.fill = item.fill
      KNOCKED.seed = 150 + i
      sketchRoundRect(ctx, -item.w, -item.h, item.w * 2, item.h * 2, 3, KNOCKED)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  clear(): void {
    for (const body of this.bodies)
      Matter.Composite.remove(this.engine.world, body)
    this.bodies.length = 0
    this.items.length = 0
  }

  dispose(): void {
    this.clear()
    Matter.Engine.clear(this.engine)
  }
}

const KNOCKED: SketchStyle = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2,
  wobble: 1
}
