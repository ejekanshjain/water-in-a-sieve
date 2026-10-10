import { GROUND_Y } from '../game/tuning'
import {
  boilSeed,
  palette,
  sketchLine,
  sketchPolygon,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type Viewport
} from '../shared'
import { drawSpeech } from './art/bubble'
import { drawHero, drawHeroHead, type HeroPose } from './art/hero'
import type { Cue } from './cutscenes'
import { roomRimY, type HouseScene } from './house'
import { wash } from './progress'

/** The ending's beats, in ms. Shots change at KITCHEN_MS, BACK_MS and STARE_MS. */
const CAP_MS = 450
const WALK_FROM_MS = 800
const WALK_TO_MS = 1500
const LAND_MS = 1950
const KITCHEN_MS = 3400
/** Every tap bursts on, then the sink overflows. The pour loop runs from here to the stare. */
export const TAPS_ON_MS = 3600
const OVERFLOW_MS = 4100
const BACK_MS = 5600
const PHONE_MS = 6500
const WATER_CO_MS = 6700
const WATER_CO_END_MS = 8500
const INTERVIEW_MS = 9200
const LAST_YEAR_MS = 10_000
export const STARE_MS = 11_000
const FADE_MS = 220

/** The ending's sounds, captions and the share card's snap of you in the tub. */
export const ENDING_CUES: readonly Cue[] = [
  { at: 150, caption: '100 L. Full.', captionMs: 1500, sound: 'ding' },
  { at: CAP_MS, sound: 'pop', pitch: 1.3 },
  { at: WALK_TO_MS, sound: 'whoosh', pitch: 0.8 },
  { at: LAND_MS, sound: 'splash', shake: 4 },
  { at: LAND_MS + 50, sound: 'splash', pitch: 0.7, volume: 0.6 },
  { at: 2300, caption: 'Ahh.', captionMs: 1000 },
  { at: 2900, action: 'snap' },
  {
    at: TAPS_ON_MS,
    sound: 'rattle',
    shake: 3,
    caption: 'Every tap in the house bursts on.',
    captionMs: 1700
  },
  { at: TAPS_ON_MS + 80, sound: 'splash' },
  { at: OVERFLOW_MS, sound: 'splash', pitch: 0.8 },
  { at: BACK_MS + 200, sound: 'ring' },
  { at: BACK_MS + 700, sound: 'ring' },
  { at: INTERVIEW_MS - 500, sound: 'ring' },
  { at: INTERVIEW_MS - 150, sound: 'ring' },
  { at: LAST_YEAR_MS + 100, sound: 'fail', volume: 0.7 },
  { at: STARE_MS + 700, sound: 'drip', pitch: 0.9 },
  { at: STARE_MS + 1300, sound: 'tick', volume: 0.4 }
]

/** Sitting in the tub: shoulders and head show above the rim. */
const BATH_GROUND_Y = 801
const BATH_X = 420
/** Where the hero hops in from. */
const HOP_FROM_X = 290

const RIM: SketchStyle = { color: palette.ink, width: 7, seed: 640 }
const TAP: SketchStyle = { color: palette.ink, width: 7, passes: 1, seed: 641 }
const SHIRT: SketchStyle = {
  fill: '#ffffff',
  color: palette.ink,
  width: 4,
  wobble: 2,
  seed: 642
}
const TIE: SketchStyle = {
  fill: palette.red,
  color: palette.ink,
  width: 3,
  wobble: 1.5,
  seed: 643
}
const WATER = 'rgba(116, 192, 252, 0.85)'
const STREAM = 'rgba(116, 192, 252, 0.95)'
const tiePoints = new Float64Array([270, 556, 294, 660, 270, 700, 246, 660])

/**
 * The ending: you put on a shower cap and step into the full tub, every tap in the house
 * bursts on and the sink overflows, the water company rings to say you're back on, the
 * interviewer rings to say it was last year, and you stare at the camera.
 */
export class EndingScene {
  private readonly pose: HeroPose = {
    x: BATH_X,
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

  constructor(
    private readonly viewport: Viewport,
    private readonly house: HouseScene
  ) {}

  draw(ctx: CanvasRenderingContext2D, ms: number, timeMs: number): void {
    if (ms < KITCHEN_MS) this.stepIn(ctx, ms, timeMs)
    else if (ms < BACK_MS) this.kitchen(ctx, ms, timeMs)
    else if (ms < STARE_MS) this.calls(ctx, ms, timeMs)
    else this.stare(ctx, ms, timeMs)
    for (const cut of CUTS) {
      const from = Math.abs(ms - cut)
      if (from < FADE_MS) wash(ctx, this.viewport, 1 - from / FADE_MS)
    }
  }

  /** A fresh pose for this frame, with the shower cap on once you've put it on. */
  private reset(ms: number, timeMs: number): HeroPose {
    const pose = this.pose
    pose.x = BATH_X
    pose.groundY = GROUND_Y
    pose.stride = 0
    pose.speed = 0
    pose.facing = 1
    pose.worry = 0
    pose.despair = false
    pose.arms = 'down'
    pose.smug = false
    pose.cap = ms >= CAP_MS
    pose.stare = false
    pose.timeMs = timeMs
    return pose
  }

  /** The cap goes on, you walk to the tub, hop in and sigh. */
  private stepIn(
    ctx: CanvasRenderingContext2D,
    ms: number,
    timeMs: number
  ): void {
    this.house.drawRoom(ctx, 'bathroom', 1, timeMs, 'water')
    const pose = this.reset(ms, timeMs)
    pose.smug = true
    if (ms < WALK_TO_MS) {
      const walk = clamp01((ms - WALK_FROM_MS) / (WALK_TO_MS - WALK_FROM_MS))
      pose.x = 190 + walk * (HOP_FROM_X - 190)
      pose.speed = walk > 0 && walk < 1 ? 2.5 : 0
      pose.stride = (ms / 450) % 1
      // Both hands up to pull the cap on.
      if (ms > CAP_MS - 250 && ms < CAP_MS + 250) pose.arms = 'up'
      drawHero(ctx, pose)
      return
    }
    if (ms < LAND_MS) {
      // A hop over the rim, arms up, and down into the water.
      const t = (ms - WALK_TO_MS) / (LAND_MS - WALK_TO_MS)
      pose.x = HOP_FROM_X + t * (BATH_X - HOP_FROM_X)
      pose.groundY =
        GROUND_Y + (BATH_GROUND_Y - GROUND_Y) * t - Math.sin(t * Math.PI) * 160
      pose.arms = 'up'
      if (t < 0.55) drawHero(ctx, pose)
      else this.inTub(ctx, pose)
      return
    }
    this.inTub(ctx, pose)
    splashDrops(ctx, (ms - LAND_MS) / 600)
    if (ms > 2200) steam(ctx, timeMs)
  }

  /** The kitchen tap gushes and the full sink spills over the counter onto the floor. */
  private kitchen(
    ctx: CanvasRenderingContext2D,
    ms: number,
    timeMs: number
  ): void {
    this.house.drawRoom(ctx, 'kitchen', 1, timeMs)
    if (ms < TAPS_ON_MS) return
    const on = clamp01((ms - TAPS_ON_MS) / 200)
    gush(ctx, 438, 640, 440, 694, 4 + on * 12, timeMs)
    sketchText(ctx, 'FWOOSH', 470, 590, {
      font: 'marker',
      size: 30,
      tilt: 0.2,
      seed: boilSeed(ms, 7)
    })
    if (ms < OVERFLOW_MS) return
    const spill = clamp01((ms - OVERFLOW_MS) / 1200)
    // Over the counter's front edge and down to the floor.
    ctx.fillStyle = WATER
    const sway = Math.sin(timeMs / 90) * 3
    ctx.fillRect(356 + sway, 690, 88, 80 * Math.min(1, spill * 3))
    floorPuddle(ctx, 400, 40 + spill * 220, timeMs)
  }

  /** Back in the tub as it overflows: two calls, one after the other. */
  private calls(
    ctx: CanvasRenderingContext2D,
    ms: number,
    timeMs: number
  ): void {
    this.house.drawRoom(ctx, 'bathroom', 1, timeMs, 'water')
    // The bath tap is on too, and the tub has nowhere left to put it.
    sketchLine(ctx, 548, 600, 516, 600, TAP)
    sketchLine(ctx, 516, 600, 516, 614, TAP)
    gush(ctx, 516, 616, 506, 676, 12, timeMs)
    const spill = clamp01((ms - BACK_MS) / 2500)
    ctx.fillStyle = WATER
    const rim = roomRimY('bathroom')
    for (const x of [306, 534]) {
      const sway = Math.sin(timeMs / 80 + x) * 2
      ctx.fillRect(x - 6 + sway, rim, 12, GROUND_Y - rim)
    }
    floorPuddle(ctx, 420, 140 + spill * 160, timeMs)

    const pose = this.reset(ms, timeMs)
    pose.arms = ms > PHONE_MS ? 'phone' : 'down'
    pose.smug = ms > WATER_CO_MS && ms < INTERVIEW_MS
    pose.worry = ms > LAST_YEAR_MS ? 0.9 : 0
    this.inTub(ctx, pose)
    const ringing =
      (ms < PHONE_MS && ms > BACK_MS + 100) ||
      (ms > INTERVIEW_MS - 600 && ms < INTERVIEW_MS)
    if (ringing && Math.floor(ms / 120) % 2 === 0)
      sketchText(ctx, 'ring!', BATH_X + 70, 520, {
        font: 'marker',
        size: 28,
        tilt: 0.25,
        seed: boilSeed(ms, 8)
      })
    // The bubble sits up and left of you, its tail pointing at the phone.
    if (ms > WATER_CO_MS && ms < WATER_CO_END_MS)
      drawSpeech(ctx, 290, 470, 470, "Water company: You're back on.", 390, 548)
    else if (ms > INTERVIEW_MS && ms < LAST_YEAR_MS)
      drawSpeech(
        ctx,
        290,
        470,
        470,
        'Interviewer: About your interview.',
        390,
        548
      )
    else if (ms >= LAST_YEAR_MS)
      drawSpeech(ctx, 290, 470, 380, 'That was last year.', 390, 548)
  }

  /** A close-up: shower cap, chest-deep, staring straight at you. A drip runs down. */
  private stare(
    ctx: CanvasRenderingContext2D,
    ms: number,
    timeMs: number
  ): void {
    const view = this.viewport.view
    ctx.fillStyle = '#dff0f7'
    ctx.fillRect(view.x, view.y, view.width, view.height)
    sketchRoundRect(ctx, 150, 540, 240, 320, 40, SHIRT)
    sketchPolygon(ctx, tiePoints, TIE)
    ctx.fillStyle = WATER
    const wave = Math.sin(timeMs / 400) * 4
    ctx.fillRect(view.x, 680 + wave, view.width, view.y + view.height - 680)
    const pose = this.reset(ms, timeMs)
    pose.cap = true
    pose.stare = true
    ctx.save()
    ctx.translate(270, 450)
    ctx.scale(3.2, 3.2)
    drawHeroHead(ctx, 0, 0, pose)
    // One drop slides off the cap and down your cheek.
    const drip = clamp01((ms - STARE_MS - 500) / 1200)
    if (drip > 0) {
      ctx.fillStyle = palette.water
      ctx.beginPath()
      ctx.arc(-24, -10 + drip * 40, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /** You, sitting in the tub: only what's above the rim shows, with the rim over your chest. */
  private inTub(ctx: CanvasRenderingContext2D, pose: HeroPose): void {
    const view = this.viewport.view
    const rim = roomRimY('bathroom')
    ctx.save()
    ctx.beginPath()
    ctx.rect(view.x, view.y, view.width, rim + 2 - view.y)
    ctx.clip()
    drawHero(ctx, pose)
    ctx.restore()
    ctx.fillStyle = WATER
    ctx.beginPath()
    ctx.ellipse(pose.x, rim + 3, 46, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    sketchLine(ctx, 296, rim, 544, rim, RIM)
  }
}

/** Shot changes, each with a quick fade through paper. */
const CUTS: readonly number[] = [KITCHEN_MS, BACK_MS, STARE_MS]

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

/** A wobbling jet of water from a tap down to (toX, toY). */
function gush(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  timeMs: number
): void {
  ctx.strokeStyle = STREAM
  ctx.lineCap = 'round'
  ctx.lineWidth = width + Math.sin(timeMs / 50) * 2
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.quadraticCurveTo(
    fromX + Math.sin(timeMs / 70) * 4,
    (fromY + toY) / 2,
    toX,
    toY
  )
  ctx.stroke()
  // Spray where it lands.
  ctx.fillStyle = STREAM
  for (let i = 0; i < 5; i++) {
    const a = timeMs / 90 + i * 1.3
    ctx.beginPath()
    ctx.arc(
      toX + Math.cos(a) * 14,
      toY - Math.abs(Math.sin(a)) * 16,
      3,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }
}

/** A puddle spreading across the floor around x. */
function floorPuddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  halfWidth: number,
  timeMs: number
): void {
  ctx.fillStyle = 'rgba(116, 192, 252, 0.6)'
  ctx.beginPath()
  ctx.ellipse(
    x,
    GROUND_Y + 14,
    halfWidth + Math.sin(timeMs / 300) * 4,
    16,
    0,
    0,
    Math.PI * 2
  )
  ctx.fill()
}

/** Water thrown up as you land in the tub, `t` from 0 to 1 over its flight. */
function splashDrops(ctx: CanvasRenderingContext2D, t: number): void {
  if (t >= 1) return
  const rim = roomRimY('bathroom')
  ctx.fillStyle = STREAM
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i - 4.5) * 0.28
    const speed = 260 + (i % 3) * 60
    const x = BATH_X + Math.cos(a) * speed * t
    const y = rim + Math.sin(a) * speed * t + 500 * t * t
    ctx.beginPath()
    ctx.arc(x, y, 5 - t * 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Three wisps of steam rising off the bath. */
function steam(ctx: CanvasRenderingContext2D, timeMs: number): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const x = BATH_X - 80 + i * 80
    const rise = (timeMs / 1600 + i * 0.33) % 1
    ctx.globalAlpha = 1 - rise
    ctx.beginPath()
    for (let k = 0; k <= 6; k++) {
      const y = 650 - rise * 60 - k * 12
      const px = x + Math.sin(k * 0.9 + timeMs / 300) * 7
      if (k === 0) ctx.moveTo(px, y)
      else ctx.lineTo(px, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
