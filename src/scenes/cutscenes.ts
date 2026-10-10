import type { GameState } from '../game/sim'
import { COLD_OPEN_MS, GROUND_Y } from '../game/tuning'
import type { CutsceneId } from '../game/types'
import {
  boilSeed,
  CachedLayer,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SfxName,
  type SketchStyle,
  type Viewport
} from '../shared'
import { drawHero, type HeroPose } from './art/hero'
import { ENDING_CUES, EndingScene } from './ending'
import type { HouseScene } from './house'
import type { PathScene } from './path'
import {
  BUCKET_DONE_CUES,
  CAT_CUES,
  DUCK_CUES,
  ProgressScenes,
  RESCHEDULE_CUES,
  SINK_DONE_CUES
} from './progress'

/** Something that happens at a moment of a cutscene: a sound, a caption, a shake or an action. */
export interface Cue {
  at: number
  sound?: SfxName
  pitch?: number
  volume?: number
  caption?: string
  captionMs?: number
  shake?: number
  /**
   * The renderer kicks the bucket into the shed, shuts its door, drops autumn leaves, or
   * snaps this frame as the picture for a share card.
   */
  action?: 'kick' | 'shut' | 'leaves' | 'snap'
}

/** The cold open's beats: the bathroom tap coughs, then a sieve from the kitchen drawer. */
export const COLD_OPEN_CUES: readonly Cue[] = [
  { at: 900, sound: 'crank', pitch: 1.6, volume: 0.5 },
  { at: 1150, sound: 'rattle', shake: 4 },
  { at: 1450, sound: 'drip', pitch: 1.2 },
  { at: 1800, sound: 'drip', pitch: 0.8, volume: 0.6 },
  {
    at: 2100,
    caption: "Water's off. Interview at 9.",
    captionMs: 1900
  },
  { at: 3850, sound: 'whoosh', volume: 0.5 },
  { at: 5250, sound: 'thud', volume: 0.5, pitch: 1.4 },
  { at: 5750, sound: 'ding' },
  { at: 6150, caption: "This'll do.", captionMs: 1700 }
]

/** When the scene cuts from the bathroom to the kitchen, and how long the fade takes. */
const CUT_MS = 4000
const FADE_MS = 220

const WALL_BATH = '#dff0f7'
const WALL_KITCHEN = '#fff3dc'
const FLOOR = '#e9dfcf'
const WHITE: SketchStyle = { fill: '#ffffff', color: palette.ink, width: 3 }
const MIRROR: SketchStyle = {
  fill: '#e8f4fb',
  color: palette.ink,
  width: 4,
  seed: 201
}
const NOTE: SketchStyle = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2,
  seed: 202
}
const COUNTER: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 7,
  color: palette.ink,
  width: 3,
  seed: 210
}
const TOP: SketchStyle = {
  fill: '#d9c3a0',
  color: palette.ink,
  width: 3,
  seed: 211
}
const WINDOW: SketchStyle = {
  fill: '#d6ecfb',
  color: palette.ink,
  width: 3,
  seed: 212
}
const DRAWER: SketchStyle = {
  fill: '#c79a63',
  color: palette.ink,
  width: 3,
  seed: 213
}
const TAP: SketchStyle = { color: palette.ink, width: 7, passes: 1, seed: 220 }
const RIM: SketchStyle = { color: '#9a6a3a', width: 5, wobble: 1.5, seed: 221 }
const MESH: SketchStyle = {
  fill: 'rgba(120,120,120,0.35)',
  fillStyle: 'hatch',
  hatchGap: 5,
  color: palette.inkSoft,
  width: 1.5,
  wobble: 1,
  seed: 222
}
const ARM: SketchStyle = { color: palette.ink, width: 9, passes: 1, wobble: 1 }

/** Mirror with the interview note and the basin, painted once. */
function paintBathroom(ctx: CanvasRenderingContext2D): void {
  sketchRoundRect(ctx, 320, 360, 160, 130, 14, MIRROR)
  sketchLine(ctx, 345, 470, 380, 385, { color: '#ffffff', width: 5, seed: 203 })
  sketchRect(ctx, 430, 350, 62, 50, NOTE)
  sketchText(ctx, 'INTERVIEW', 461, 367, { size: 13, rotate: 0.08 })
  sketchText(ctx, '9AM', 461, 387, { size: 18, rotate: 0.08, font: 'marker' })
  WHITE.seed = 204
  sketchRect(ctx, 385, 650, 44, 120, WHITE)
  WHITE.seed = 205
  sketchEllipse(ctx, 407, 640, 82, 24, WHITE)
  sketchEllipse(ctx, 407, 636, 60, 12, {
    fill: '#cfe3ec',
    width: 2,
    seed: 206
  })
  // Towel on its rail, for a bit of colour.
  sketchLine(ctx, 60, 520, 170, 520, { width: 4, seed: 207 })
  sketchRect(ctx, 80, 520, 70, 110, {
    fill: palette.pink,
    fillStyle: 'hatch',
    hatchGap: 6,
    width: 2.5,
    seed: 208
  })
}

/** Counter, drawer hole and the window onto the garden well, painted once. */
function paintKitchen(ctx: CanvasRenderingContext2D): void {
  sketchRect(ctx, 70, 380, 170, 130, WINDOW)
  ctx.fillStyle = '#cfe8b0'
  ctx.fillRect(74, 465, 162, 42)
  // The well, far away at the bottom of the garden.
  sketchRect(ctx, 190, 448, 26, 22, { fill: '#b8b0a6', width: 2, seed: 214 })
  sketchLine(ctx, 186, 448, 203, 432, { width: 2, seed: 215 })
  sketchLine(ctx, 220, 448, 203, 432, { width: 2, seed: 216 })
  sketchLine(ctx, 155, 380, 155, 510, { width: 2, seed: 217 })
  sketchRect(ctx, -10, 620, 560, 26, TOP)
  sketchRect(ctx, 0, 646, 540, 124, COUNTER)
  ctx.fillStyle = '#3b2a1c'
  ctx.fillRect(312, 664, 126, 40)
  // Dirty dishes waiting for water.
  sketchEllipse(ctx, 120, 612, 46, 10, { ...WHITE, seed: 218 })
  sketchEllipse(ctx, 126, 600, 40, 9, { ...WHITE, seed: 219 })
  sketchCircle(ctx, 470, 596, 22, {
    fill: palette.red,
    width: 2.5,
    seed: 223
  })
}

/**
 * The 8s cold open: you turn the bathroom tap and it coughs dry, then you fetch a sieve
 * from the kitchen drawer. Cues in `COLD_OPEN_CUES` carry its sounds and captions.
 */
export class ColdOpen {
  private readonly bathroom: CachedLayer
  private readonly kitchen: CachedLayer
  private readonly pose: HeroPose = {
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

  constructor(private readonly viewport: Viewport) {
    const rect = { x: 0, y: 330, width: 540, height: 450 }
    this.bathroom = new CachedLayer(viewport, paintBathroom, rect)
    this.kitchen = new CachedLayer(viewport, paintKitchen, rect)
  }

  get layers(): CachedLayer[] {
    return [this.bathroom, this.kitchen]
  }

  invalidate(): void {
    this.bathroom.invalidate()
    this.kitchen.invalidate()
  }

  dispose(): void {
    this.bathroom.dispose()
    this.kitchen.dispose()
  }

  /** Draws the cold open at `ms` into it. */
  draw(ctx: CanvasRenderingContext2D, ms: number, timeMs: number): void {
    if (ms < CUT_MS) this.drawBathroom(ctx, ms, timeMs)
    else this.drawKitchen(ctx, ms - CUT_MS, timeMs)
    // A quick fade through paper at the cut.
    const fromCut = Math.abs(ms - CUT_MS)
    if (fromCut < FADE_MS) this.wash(ctx, 1 - fromCut / FADE_MS)
    if (ms > COLD_OPEN_MS - FADE_MS)
      this.wash(ctx, (ms - (COLD_OPEN_MS - FADE_MS)) / FADE_MS)
  }

  private room(ctx: CanvasRenderingContext2D, wall: string): void {
    const view = this.viewport.view
    ctx.fillStyle = wall
    ctx.fillRect(view.x, view.y, view.width, GROUND_Y - view.y)
    ctx.fillStyle = FLOOR
    ctx.fillRect(view.x, GROUND_Y, view.width, view.y + view.height - GROUND_Y)
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(view.x, GROUND_Y)
    ctx.lineTo(view.x + view.width, GROUND_Y)
    ctx.stroke()
  }

  private drawBathroom(
    ctx: CanvasRenderingContext2D,
    ms: number,
    timeMs: number
  ): void {
    const view = this.viewport.view
    this.room(ctx, WALL_BATH)
    // Wall tiles.
    ctx.strokeStyle = 'rgba(80, 140, 170, 0.25)'
    ctx.lineWidth = 2
    ctx.beginPath()
    const left = Math.floor(view.x / 60) * 60
    for (let x = left; x < view.x + view.width; x += 60) {
      ctx.moveTo(x, view.y)
      ctx.lineTo(x, GROUND_Y)
    }
    for (let y = 330; y < GROUND_Y; y += 60) {
      ctx.moveTo(view.x, y)
      ctx.lineTo(view.x + view.width, y)
    }
    ctx.stroke()
    this.bathroom.draw(ctx)

    // The tap turns, coughs and shakes, then gives up.
    const coughing = ms > 1150 && ms < 1700
    const jitter = coughing ? Math.sin(timeMs * 0.9) * 3 : 0
    const turn = Math.min(1, Math.max(0, (ms - 800) / 250))
    sketchLine(ctx, 407 + jitter, 612, 407 + jitter, 586, TAP)
    sketchLine(ctx, 407 + jitter, 586, 386 + jitter, 586, TAP)
    ctx.save()
    ctx.translate(410 + jitter, 574)
    ctx.rotate(turn * 1.4)
    sketchLine(ctx, -14, 0, 14, 0, { width: 6, passes: 1, seed: 224 })
    sketchLine(ctx, 0, -10, 0, 10, { width: 6, passes: 1, seed: 225 })
    ctx.restore()
    if (coughing) {
      sketchText(ctx, 'hkk!', 350, 560, {
        font: 'marker',
        size: 26,
        tilt: 0.2,
        seed: boilSeed(ms, 8)
      })
      ctx.fillStyle = palette.water
      ctx.beginPath()
      ctx.arc(386, 600 + ((ms - 1150) % 260) * 0.15, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    if (ms > 1700 && ms < 2100) {
      ctx.fillStyle = palette.water
      ctx.beginPath()
      ctx.arc(386, 596 + (ms - 1700) * 0.08, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    const pose = this.pose
    pose.x = 300
    pose.facing = 1
    pose.speed = 0
    pose.stride = 0
    pose.worry = ms > 1150 ? 0.9 : 0
    pose.despair = ms > 2100
    pose.timeMs = timeMs
    drawHero(ctx, pose)
    // Reaching for the tap.
    const reach = Math.min(1, Math.max(0, (ms - 400) / 400))
    if (reach > 0 && ms < 2400) {
      ARM.seed = 230
      sketchLine(
        ctx,
        308,
        GROUND_Y - 154,
        308 + reach * 92,
        GROUND_Y - 154 - reach * 40,
        ARM
      )
    }
  }

  private drawKitchen(
    ctx: CanvasRenderingContext2D,
    ms: number,
    timeMs: number
  ): void {
    this.room(ctx, WALL_KITCHEN)
    this.kitchen.draw(ctx)
    // The drawer slides out, then the sieve rises out of it.
    const open = Math.min(1, Math.max(0, (ms - 1200) / 250))
    sketchRect(ctx, 312 - open * 46, 664, 126, 40, DRAWER)
    sketchCircle(ctx, 375 - open * 46, 684, 5, {
      fill: palette.yellow,
      width: 1.5,
      seed: 226
    })

    const pose = this.pose
    const walk = Math.min(1, ms / 1000)
    pose.x = 80 + walk * 150
    pose.facing = 1
    pose.speed = walk < 1 ? 2.5 : 0
    pose.stride = (ms / 450) % 1
    pose.despair = false
    pose.worry = 0
    pose.timeMs = timeMs
    drawHero(ctx, pose)

    const lift = Math.min(1, Math.max(0, (ms - 1500) / 450))
    if (lift > 0) {
      // Held up proudly in front, clear of the face.
      const sx = 380 - lift * 10
      const sy = 660 - lift * 160
      ARM.seed = 231
      sketchLine(ctx, 238, GROUND_Y - 154, sx - 34, sy + 6, ARM)
      MESH.seed = 222
      sketchEllipse(ctx, sx, sy + 4, 46, 11, MESH)
      sketchEllipse(ctx, sx, sy, 48, 10, RIM)
      if (ms > 1750 && ms < 3200) this.sparkles(ctx, sx, sy, timeMs)
    }
  }

  private sparkles(
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
      const r = 66 + Math.sin(timeMs / 120 + i) * 8
      const cx = x + Math.cos(a) * r
      const cy = y + Math.sin(a) * r * 0.7
      ctx.moveTo(cx - 7, cy)
      ctx.lineTo(cx + 7, cy)
      ctx.moveTo(cx, cy - 7)
      ctx.lineTo(cx, cy + 7)
    }
    ctx.stroke()
  }

  private wash(ctx: CanvasRenderingContext2D, alpha: number): void {
    const view = this.viewport.view
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    ctx.fillStyle = palette.paper
    ctx.fillRect(view.x, view.y, view.width, view.height)
    ctx.globalAlpha = 1
  }
}

/** Every cutscene's cues, keyed by its phase. */
export const CUES: Record<CutsceneId, readonly Cue[]> = {
  coldOpen: COLD_OPEN_CUES,
  bucketDone: BUCKET_DONE_CUES,
  sinkDone: SINK_DONE_CUES,
  duck: DUCK_CUES,
  catTest: CAT_CUES,
  reschedule: RESCHEDULE_CUES,
  ending: ENDING_CUES
}

/** Draws whichever cutscene the sim is playing. */
export class Cutscenes {
  private readonly coldOpen: ColdOpen
  private readonly progress: ProgressScenes
  private readonly ending: EndingScene

  constructor(viewport: Viewport, house: HouseScene, path: PathScene) {
    this.coldOpen = new ColdOpen(viewport)
    this.progress = new ProgressScenes(viewport, house, path)
    this.ending = new EndingScene(viewport, house)
  }

  get layers(): CachedLayer[] {
    return [...this.coldOpen.layers, ...this.progress.layers]
  }

  invalidate(): void {
    for (const layer of this.layers) layer.invalidate()
  }

  dispose(): void {
    for (const layer of this.layers) layer.dispose()
  }

  draw(ctx: CanvasRenderingContext2D, state: GameState, timeMs: number): void {
    const ms = state.phaseMs
    switch (state.phase) {
      case 'bucketDone':
        return this.progress.bucketDone(ctx, ms, timeMs)
      case 'sinkDone':
        return this.progress.sinkDone(ctx, ms, timeMs)
      case 'duck':
        return this.progress.duck(ctx, state, ms, timeMs)
      case 'catTest':
        return this.progress.catTest(ctx, state, ms, timeMs)
      case 'reschedule':
        return this.progress.reschedule(ctx, state, ms, timeMs)
      case 'ending':
        return this.ending.draw(ctx, ms, timeMs)
      default:
        return this.coldOpen.draw(ctx, ms, timeMs)
    }
  }
}
