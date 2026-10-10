import type { GameState } from '../game/sim'
import { MILESTONE_LINES } from '../game/story'
import { GROUND_Y } from '../game/tuning'
import {
  CachedLayer,
  palette,
  sketchEllipse,
  sketchLine,
  sketchPolygon,
  sketchRect,
  type SketchStyle,
  type Viewport
} from '../shared'
import { drawCat, drawDuck, type CatPose } from './art/animals'
import { drawSpeech } from './art/bubble'
import { drawHero, type HeroPose } from './art/hero'
import type { Cue } from './cutscenes'
import { DUCK_RIM_X, roomRimY, roomWaterY, type HouseScene } from './house'
import type { PathScene } from './path'
import { drawBucket } from './physics'

/** Where the empty bucket waits to be kicked, its launch, and the shed's back wall. */
export const KICK = { x: 236, y: GROUND_Y - 24, vx: 600, vy: -360 }
export const SHED_WALL_X = 506

/** Shot changes, in ms into each cutscene. */
const BUCKET_TOILET_MS = 2000
const BUCKET_SHED_MS = 3800
const KICK_MS = 4400
const SHUT_MS = 5300
const SINK_BATH_MS = 3400
const FADE_MS = 220

/** The bucket fills: the toilet flushes once, then the bucket gets kicked into the shed. */
export const BUCKET_DONE_CUES: readonly Cue[] = [
  { at: 150, caption: 'Bucket: done.', captionMs: 1700, sound: 'ding' },
  { at: 450, sound: 'coin' },
  { at: 2300, sound: 'pour', volume: 0.7 },
  { at: 2450, caption: 'The toilet flushes once.', captionMs: 1500 },
  { at: 3000, sound: 'whoosh', pitch: 0.6 },
  { at: 3150, sound: 'rattle', volume: 0.5 },
  { at: KICK_MS, sound: 'thud', shake: 3, action: 'kick' },
  { at: 4880, sound: 'slam', volume: 0.5, pitch: 1.3 },
  { at: SHUT_MS, sound: 'slam', shake: 5, action: 'shut' },
  {
    at: 5400,
    caption: '+50 coins. Next: the kitchen sink.',
    captionMs: 1500
  },
  { at: 6000, sound: 'wind', volume: 0.6, action: 'leaves' },
  { at: 6200, caption: 'Autumn.', captionMs: 1100 }
]

/** The sink fills: one plate gets washed, then you meet the bathtub. */
export const SINK_DONE_CUES: readonly Cue[] = [
  { at: 150, caption: 'Sink: done.', captionMs: 1500, sound: 'ding' },
  { at: 450, sound: 'coin' },
  { at: 1000, sound: 'scrub' },
  { at: 1400, sound: 'scrub', pitch: 1.1 },
  { at: 1800, sound: 'scrub' },
  {
    at: 2300,
    caption: 'One clean plate. Worth it.',
    captionMs: 1100,
    sound: 'ding',
    pitch: 1.3
  },
  {
    at: 4300,
    caption: '+100 coins. Next: the bathtub.',
    captionMs: 1500
  },
  { at: 5800, caption: '100 L.', captionMs: 1300, sound: 'fail' }
]

/** 25 L: the rubber duck finally floats. */
export const DUCK_CUES: readonly Cue[] = [
  { at: 950, sound: 'pop', pitch: 1.8 },
  { at: 1000, sound: 'splash', pitch: 1.5, volume: 0.4 },
  { at: 1100, caption: MILESTONE_LINES[0], captionMs: 1800 },
  { at: 1500, action: 'snap' }
]

/** 50 L: the cat tests the water and is appalled. */
export const CAT_CUES: readonly Cue[] = [
  { at: 1650, sound: 'meow' },
  { at: 1750, sound: 'splash', pitch: 1.6, volume: 0.3 },
  { at: 1800, caption: MILESTONE_LINES[1], captionMs: 1300 },
  { at: 2050, action: 'snap' },
  { at: 2450, sound: 'meow', pitch: 1.4 },
  { at: 3000, caption: 'It does not approve.', captionMs: 600 }
]

/** 75 L: the interviewer calls to push the interview back. */
export const RESCHEDULE_CUES: readonly Cue[] = [
  { at: 200, sound: 'ring' },
  { at: 800, sound: 'ring' },
  { at: 2700, caption: MILESTONE_LINES[2], captionMs: 1100 },
  { at: 2950, action: 'snap' }
]

const SHED_WOOD: SketchStyle = {
  fill: '#b98a5a',
  fillStyle: 'hatch',
  hatchGap: 8,
  color: palette.ink,
  width: 3,
  seed: 501
}
const SHED_ROOF: SketchStyle = {
  fill: palette.green,
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  seed: 502
}
const SHED_DARK: SketchStyle = { fill: '#3b2a1c', width: 0, seed: 503 }
const DOOR: SketchStyle = {
  fill: '#8d5524',
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  seed: 504
}
const roofPoints = new Float64Array([366, 566, 470, 476, 574, 566])

/** The garden shed, door frame and dark inside; the door itself is drawn live. */
function paintShed(ctx: CanvasRenderingContext2D): void {
  sketchRect(ctx, 384, 560, 172, 210, SHED_WOOD)
  sketchPolygon(ctx, roofPoints, SHED_ROOF)
  sketchRect(ctx, 410, 596, 100, 174, SHED_DARK)
  sketchLine(ctx, 410, 596, 510, 596, { width: 3, seed: 505 })
}

const WHITE: SketchStyle = { fill: '#ffffff', color: palette.ink, width: 3 }

/** A toilet, lid up, for the one flush the bucket buys. */
function paintToilet(ctx: CanvasRenderingContext2D): void {
  sketchRect(ctx, 150, 606, 62, 64, { ...WHITE, seed: 510 })
  sketchRect(ctx, 146, 600, 70, 10, { ...WHITE, seed: 511 })
  sketchRect(ctx, 162, 668, 40, 70, { ...WHITE, seed: 512 })
  sketchEllipse(ctx, 198, 690, 56, 14, { ...WHITE, seed: 513 })
  sketchEllipse(ctx, 198, 688, 42, 8, {
    fill: '#cfe3ec',
    width: 2,
    seed: 514
  })
  sketchRect(ctx, 170, 738, 40, 32, { ...WHITE, seed: 515 })
}

const ARM: SketchStyle = { color: palette.ink, width: 9, passes: 1, wobble: 1 }
const PLATE: SketchStyle = { ...WHITE, width: 2.5, seed: 520 }

/**
 * The cutscenes for filling the bucket and the sink, and the bathtub's milestone gags.
 * Rooms come from the house scene, so the gags happen in the real bathroom.
 */
export class ProgressScenes {
  readonly layers: CachedLayer[]
  private readonly shed: CachedLayer
  private readonly toilet: CachedLayer
  private readonly hero: HeroPose = {
    x: 260,
    groundY: GROUND_Y,
    stride: 0,
    speed: 0,
    facing: 1,
    carrying: false,
    water: 0,
    worry: 0,
    despair: false,
    tremble: 0,
    lean: 0,
    fall: 0,
    timeMs: 0
  }
  private readonly cat: CatPose = {
    facing: 1,
    stride: 0,
    puff: 0,
    paw: 0,
    timeMs: 0
  }

  constructor(
    private readonly viewport: Viewport,
    private readonly house: HouseScene,
    private readonly path: PathScene
  ) {
    this.shed = new CachedLayer(viewport, paintShed, {
      x: 356,
      y: 466,
      width: 230,
      height: 314
    })
    this.toilet = new CachedLayer(viewport, paintToilet, {
      x: 130,
      y: 590,
      width: 140,
      height: 190
    })
    this.layers = [this.shed, this.toilet]
  }

  /** Resets the hero to a plain standing pose for this frame. */
  private pose(x: number, facing: 1 | -1, timeMs: number): HeroPose {
    const pose = this.hero
    pose.x = x
    pose.facing = facing
    pose.stride = 0
    pose.speed = 0
    pose.carrying = false
    pose.water = 0
    pose.worry = 0
    pose.despair = false
    pose.lean = 0
    pose.timeMs = timeMs
    pose.arms = 'down'
    pose.smug = false
    return pose
  }

  bucketDone(ctx: CanvasRenderingContext2D, ms: number, timeMs: number): void {
    if (ms < BUCKET_TOILET_MS) {
      this.house.drawRoom(ctx, 'step', 1, timeMs)
      const pose = this.pose(270, 1, timeMs)
      pose.arms = 'up'
      pose.smug = true
      drawHero(ctx, pose)
    } else if (ms < BUCKET_SHED_MS) {
      this.toiletShot(ctx, ms - BUCKET_TOILET_MS, timeMs)
    } else {
      this.shedShot(ctx, ms, timeMs)
    }
    this.fades(ctx, ms, [BUCKET_TOILET_MS, BUCKET_SHED_MS])
  }

  /** The whole bucket goes down the toilet in one flush. */
  private toiletShot(
    ctx: CanvasRenderingContext2D,
    ms: number,
    timeMs: number
  ): void {
    this.house.drawRoom(ctx, 'bathroom', 0, timeMs, 'rim')
    this.toilet.draw(ctx)
    const pose = this.pose(320, -1, timeMs)
    drawHero(ctx, pose)
    // Hands on the bucket, tipping it into the bowl.
    const tip = Math.min(1, Math.max(0, (ms - 150) / 300)) * 1.5
    const bx = 232
    const by = 640
    ARM.seed = 530
    sketchLine(ctx, 312, GROUND_Y - 154, bx + 22, by + 4, ARM)
    tiltedBucket(ctx, bx, by, -tip)
    const pouring = ms > 300 && ms < 900
    if (pouring) {
      ctx.strokeStyle = 'rgba(116, 192, 252, 0.9)'
      ctx.lineWidth = 12
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(bx - 20, by - 2)
      ctx.quadraticCurveTo(bx - 34, by + 20, 200, 686)
      ctx.stroke()
    }
    if (ms > 1000 && ms < 1700) {
      // The flush swirls away.
      ctx.strokeStyle = palette.blue
      ctx.lineWidth = 2.5
      const turn = (ms - 1000) / 90
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.ellipse(
          198,
          688,
          34 - i * 10,
          6 - i * 1.5,
          0,
          turn + i,
          turn + i + 2.4
        )
        ctx.stroke()
      }
    }
  }

  /** The empty bucket gets kicked into the shed, the door slams, and autumn arrives. */
  private shedShot(
    ctx: CanvasRenderingContext2D,
    ms: number,
    timeMs: number
  ): void {
    this.path.drawBackdrop(ctx, 900, 170)
    this.shed.draw(ctx)
    if (ms < SHUT_MS) {
      // The door hangs open to the left.
      sketchRect(ctx, 366, 596, 44, 174, DOOR)
    } else {
      sketchRect(ctx, 410, 596, 100, 174, DOOR)
    }
    const pose = this.pose(160, 1, timeMs)
    const kicking = ms > KICK_MS - 150 && ms < KICK_MS + 250
    if (kicking) {
      pose.stride = 0.25
      pose.speed = 3
    }
    pose.smug = ms > SHUT_MS
    drawHero(ctx, pose)
    if (ms < KICK_MS) {
      ctx.save()
      ctx.translate(KICK.x, KICK.y)
      drawBucket(ctx)
      ctx.restore()
    }
  }

  sinkDone(ctx: CanvasRenderingContext2D, ms: number, timeMs: number): void {
    if (ms < SINK_BATH_MS) {
      this.house.drawRoom(ctx, 'kitchen', 1, timeMs)
      const pose = this.pose(270, 1, timeMs)
      pose.smug = ms > 2200
      drawHero(ctx, pose)
      // Scrub one plate, then hold it up like a trophy.
      const raised = ms > 2200
      const scrub = ms > 900 && !raised
      const px = raised ? 372 : 340 + (scrub ? Math.cos(ms / 70) * 10 : 0)
      const py = raised ? 500 : 640 + (scrub ? Math.sin(ms / 70) * 6 : 0)
      ARM.seed = 531
      sketchLine(ctx, 278, GROUND_Y - 154, px - 14, py + 4, ARM)
      sketchEllipse(ctx, px, py, 26, raised ? 22 : 7, PLATE)
      if (raised) sparkles(ctx, px, py, timeMs)
    } else {
      this.house.drawRoom(ctx, 'bathroom', 0, timeMs, 'rim')
      const walk = Math.min(1, (ms - SINK_BATH_MS) / 1000)
      const pose = this.pose(60 + walk * 170, 1, timeMs)
      pose.speed = walk < 1 ? 2.5 : 0
      pose.stride = ((ms - SINK_BATH_MS) / 450) % 1
      pose.despair = ms > 5800
      drawHero(ctx, pose)
    }
    this.fades(ctx, ms, [SINK_BATH_MS])
  }

  /** 25 L: the duck hops off the rim and floats. */
  duck(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    ms: number,
    timeMs: number
  ): void {
    const fill = tubFill(state)
    this.house.drawRoom(ctx, 'bathroom', fill, timeMs)
    const pose = this.pose(220, 1, timeMs)
    pose.smug = ms > 1000
    drawHero(ctx, pose)
    const rimY = roomRimY('bathroom') - 4
    const waterY = roomWaterY('bathroom', fill) + 6
    const t = Math.min(1, Math.max(0, (ms - 600) / 400))
    const x = DUCK_RIM_X + (470 - DUCK_RIM_X) * t
    const hop = Math.sin(t * Math.PI) * 40
    const bob = t >= 1 ? Math.sin(timeMs / 300) * 2 : 0
    drawDuck(ctx, x, rimY + (waterY - rimY) * t - hop + bob)
  }

  /** 50 L: the cat hops on the rim, dips a paw and puffs up in disgust. */
  catTest(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    ms: number,
    timeMs: number
  ): void {
    const fill = tubFill(state)
    this.house.drawRoom(ctx, 'bathroom', fill, timeMs, 'water')
    drawHero(ctx, this.pose(150, 1, timeMs))
    const cat = this.cat
    const rim = roomRimY('bathroom') - 2
    cat.timeMs = timeMs
    cat.paw = ms > 1450 && ms < 1750 ? Math.min(1, (ms - 1450) / 200) : 0
    cat.puff = ms > 1700 && ms < 2600 ? 1 : 0
    let x: number
    let y: number
    if (ms < 1100) {
      cat.facing = 1
      cat.stride = (ms / 300) % 1
      x = -60 + (ms / 1100) * 340
      y = GROUND_Y
    } else if (ms < 1400) {
      const t = (ms - 1100) / 300
      cat.stride = 0
      x = 280 + t * 50
      y = GROUND_Y + (rim - GROUND_Y) * t - Math.sin(t * Math.PI) * 50
    } else if (ms < 2400) {
      cat.stride = 0
      x = 330
      y = rim
    } else if (ms < 2900) {
      // A furious leap off the rim, then out of the door.
      const t = (ms - 2400) / 500
      cat.facing = -1
      x = 330 - t * 200
      y = rim + (GROUND_Y - rim) * t - Math.sin(t * Math.PI) * 70
    } else {
      cat.facing = -1
      cat.stride = (ms / 200) % 1
      x = 130 - ((ms - 2900) / 700) * 240
      y = GROUND_Y
    }
    drawCat(ctx, x, y, cat)
  }

  /** 75 L: the interviewer rings to push the interview back an hour. */
  reschedule(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    ms: number,
    timeMs: number
  ): void {
    this.house.drawRoom(ctx, 'bathroom', tubFill(state), timeMs, 'water')
    const pose = this.pose(230, 1, timeMs)
    pose.arms = ms > 1100 ? 'phone' : 'down'
    pose.smug = ms > 2700
    pose.worry = ms < 1100 ? 0.8 : 0
    drawHero(ctx, pose)
    if (ms < 1100 && Math.floor(ms / 120) % 2 === 0) {
      // The pocket glows and buzzes.
      ctx.fillStyle = 'rgba(255, 212, 59, 0.7)'
      ctx.beginPath()
      ctx.arc(242, GROUND_Y - 96, 14, 0, Math.PI * 2)
      ctx.fill()
    }
    if (ms > 1300 && ms < 2650)
      drawSpeech(
        ctx,
        300,
        440,
        330,
        'Interviewer: Can we do 10 instead?',
        236,
        GROUND_Y - 214
      )
  }

  /** Quick fades through paper at each shot change. */
  private fades(
    ctx: CanvasRenderingContext2D,
    ms: number,
    cuts: readonly number[]
  ): void {
    for (const cut of cuts) {
      const from = Math.abs(ms - cut)
      if (from < FADE_MS) wash(ctx, this.viewport, 1 - from / FADE_MS)
    }
  }
}

/** How full the bathtub is, 0 to 1. */
function tubFill(state: GameState): number {
  return (state.containers[2]?.inContainer ?? 0) / 100_000
}

/** The bucket tipped by `angle` around (x, y), held at its rim. */
function tiltedBucket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  drawBucket(ctx)
  ctx.restore()
}

function sparkles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number
): void {
  ctx.strokeStyle = palette.yellow
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + timeMs / 900
    const r = 46 + Math.sin(timeMs / 120 + i) * 6
    const cx = x + Math.cos(a) * r
    const cy = y + Math.sin(a) * r * 0.8
    ctx.moveTo(cx - 7, cy)
    ctx.lineTo(cx + 7, cy)
    ctx.moveTo(cx, cy - 7)
    ctx.lineTo(cx, cy + 7)
  }
  ctx.stroke()
}

/** Covers the view with paper at `alpha`, for fades. */
export function wash(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  alpha: number
): void {
  const view = viewport.view
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.fillStyle = palette.paper
  ctx.fillRect(view.x, view.y, view.width, view.height)
  ctx.globalAlpha = 1
}
