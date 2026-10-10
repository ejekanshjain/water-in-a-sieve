import {
  CALLER_NAME,
  interviewQuestion,
  RING_LINES,
  TALK_LINES,
  type Caller
} from '../game/calls'
import {
  eventSpot,
  flySpotAt,
  shadowShowing,
  type CarryEvent,
  type LeafSpot
} from '../game/events'
import type { GameState, Sim, SimEvent } from '../game/sim'
import {
  ANKLE_WEAVE_MS,
  CAM_OFFSET_SCALE,
  CAM_X,
  CAM_Y,
  GROUND_Y,
  RING_RADIUS,
  SNEEZE_AH2_MS,
  SWING_MS
} from '../game/tuning'
import {
  boilSeed,
  palette,
  sfx,
  sketchLine,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'
import { drawCat, drawDog, type CatPose } from './art/animals'
import { drawSpeech } from './art/bubble'
import { sideSievePosition } from './art/hero'
import type { LeafArt } from './art/leaf'
import { Kind, type Caption, type Particles, type Shake } from './fx'

/** The buzz repeats this often while the fly is about. */
const BUZZ_GAP_MS = 300
/** The fly's trail: this many dots, this far apart in time. */
const TRAIL_DOTS = 6
const TRAIL_GAP_MS = 35

/** The ringtone repeats this often. */
const RINGTONE_GAP_MS = 1100
/** The dog runs past in this long, and trips you this fast. */
const DOG_PASS_MS = 900
const DOG_TRIP_MS = 400
/** A swatted fly falls off the sieve for this long. */
const SPLAT_MS = 800

/** The sim events this view reacts to. */
type EventNews = Extract<
  SimEvent,
  | { type: 'eventStart' }
  | { type: 'eventStep' }
  | { type: 'eventMissed' }
  | { type: 'call' }
>

/** Effects the view borrows from the renderer. */
export interface EventFx {
  caption: Caption
  cam: Particles
  shake: Shake
  /** You go over: the fall and the sieve flying out of your hands. */
  fall: () => void
}

/**
 * Draws and voices the carry events: the falling leaf and the fly over the sieve cam with
 * their landing shadows, the same in side view, and the sneeze building up in a speech
 * bubble. It only reads game state.
 */
export class EventView {
  private readonly spot: LeafSpot = { x: 0, y: 0, height: 0 }
  private readonly trail: LeafSpot = { x: 0, y: 0, height: 0 }
  private readonly side = { x: 0, y: 0 }
  private lastBuzzAt = -1e9
  private lastRingAt = -1e9
  /** Render time now, and when the dog ran past or tripped you. */
  private nowMs = 0
  private dogAt = -1e9
  private dogTripped = false
  /** When the ankle cat wandered off or tripped you, for its exit and its smug sit. */
  private catAt = -1e9
  private catTripped = false
  private readonly cat: CatPose = {
    facing: 1,
    stride: 0,
    puff: 0,
    paw: 0,
    lap: 0,
    timeMs: 0
  }
  /** Where a swatted fly got squashed, relative to the sieve, and when. */
  private splatAt = -1e9
  private readonly splat = { x: 0, y: 0 }

  constructor(
    private readonly sim: Sim,
    private readonly art: LeafArt,
    private readonly fx: EventFx
  ) {}

  /**
   * The fly buzzes while it's about, louder as it dives and higher once it's angry; the
   * phone rings until you answer.
   */
  sounds(timeMs: number): void {
    this.nowMs = timeMs
    const event = this.sim.state.event
    if (!event || event.stage !== 'warning') return
    if (event.id === 'ring' && event.talkMs <= 0) {
      if (timeMs - this.lastRingAt < RINGTONE_GAP_MS) return
      this.lastRingAt = timeMs
      sfx.play('ring', { volume: 0.7 })
      return
    }
    if (event.id !== 'fly') return
    if (event.retreatMs > 0 || timeMs - this.lastBuzzAt < BUZZ_GAP_MS) return
    this.lastBuzzAt = timeMs
    const h = eventSpot(event, this.spot)?.height ?? 1
    sfx.play('buzz', {
      volume: 0.25 + (1 - h) * 0.5,
      pitch: event.blows > 0 ? 1.35 : 1
    })
  }

  /** Over the sieve cam: the leaf or fly, its landing shadow, or the culprit after a drain. */
  drawCam(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const state = this.sim.state
    this.drawSplat(ctx, timeMs)
    if (state.kit.swingMs > 0) drawCamSwing(ctx, state.kit.swingMs)
    const event = state.event
    if (!event || event.id === 'sneeze' || event.id === 'ring') return
    if (event.id === 'dog') {
      if (event.stage === 'warning') drawRingDog(ctx, event, timeMs)
      return
    }
    if (event.id === 'catAnkles') {
      if (event.stage === 'warning') this.drawRingCat(ctx, event, timeMs)
      return
    }
    const cx = CAM_X + state.grip.offsetX * CAM_OFFSET_SCALE
    const cy = CAM_Y + state.grip.offsetY * CAM_OFFSET_SCALE
    if (event.outcome === 'failed' && state.phase === 'drained') {
      // The culprit sits on the empty mesh while the result shows.
      if (event.id === 'leaf')
        this.art.draw(ctx, cx + event.landX, cy + event.landY, 0.4, 1, 1)
      else drawFly(ctx, cx + event.landX, cy + event.landY, 1, true, timeMs)
      return
    }
    if (event.stage !== 'warning') return
    const spot = eventSpot(event, this.spot)
    if (!spot) return
    if (shadowShowing(event))
      drawShadow(ctx, cx + event.landX, cy + event.landY, event, timeMs)
    if (event.id === 'leaf') {
      const angle = Math.sin(timeMs / 260) * 0.9 + event.side * 0.4
      this.art.draw(
        ctx,
        cx + spot.x,
        cy + spot.y,
        angle,
        1 + spot.height * 1.4,
        1
      )
      return
    }
    // A dotted trail behind the fly, then the fly, bigger while it's high.
    ctx.fillStyle = palette.inkSoft
    for (let i = 1; i <= TRAIL_DOTS; i++) {
      const at = Math.max(0, event.ms - i * TRAIL_GAP_MS)
      flySpotAt(event, at, this.trail)
      ctx.globalAlpha = 0.6 * (1 - i / (TRAIL_DOTS + 1))
      ctx.beginPath()
      ctx.arc(cx + this.trail.x, cy + this.trail.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    const x = cx + spot.x
    const y = cy + spot.y
    drawFly(ctx, x, y, 1.4 + spot.height * 0.8, event.blows > 0, timeMs)
    if (Math.sin(timeMs / 230) > 0.2)
      sketchText(ctx, 'bzz', x + 22, y - 20, boiled(BZZ, timeMs, 2))
  }

  /**
   * Side view, with the hero at `heroX`: the leaf see-sawing down, the fly round your
   * head, the sneeze's "Ah…".
   */
  drawSide(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    heroX: number,
    timeMs: number
  ): void {
    if (state.kit.swingMs > 0) drawSideSwing(ctx, heroX, state.kit.swingMs)
    const event = state.event
    if (event?.id === 'dog') return this.drawDogSide(ctx, event, heroX, timeMs)
    if (event?.id === 'catAnkles')
      return this.drawAnkleCat(ctx, event, heroX, timeMs)
    if (!event || event.stage !== 'warning') return
    if (event.id === 'ring') return this.drawCall(ctx, event, heroX, timeMs)
    const pos = sideSievePosition(heroX, GROUND_Y, 1, this.side)
    if (event.id === 'sneeze') {
      const loud = event.ms >= SNEEZE_AH2_MS
      const wobble = Math.sin(timeMs / 70) * (loud ? 3 : 1)
      // Beside your head, clear of the hint line under the cam.
      drawSpeech(
        ctx,
        heroX + 150 + wobble,
        GROUND_Y - 215,
        loud ? 130 : 110,
        loud ? 'Ah…!' : 'Ah…',
        heroX + 34,
        GROUND_Y - 200
      )
      return
    }
    const spot = eventSpot(event, this.spot)
    if (!spot) return
    const h = spot.height
    if (event.id === 'leaf') {
      const x = pos.x + event.side * 150 * h + Math.sin(timeMs / 240) * 24 * h
      this.art.draw(
        ctx,
        x,
        pos.y - 6 - 430 * h,
        Math.sin(timeMs / 260) * 0.9,
        0.8,
        1
      )
      return
    }
    // The fly loops round your head, then dives at the sieve.
    const a = timeMs / 160
    const headX = heroX + 10 + Math.cos(a) * 46
    const headY = GROUND_Y - 220 + Math.sin(a) * 18
    const x = headX + (pos.x - headX) * (1 - h)
    const y = headY + (pos.y - 4 - headY) * (1 - h)
    if (event.retreatMs <= 0) drawFly(ctx, x, y, 1, event.blows > 0, timeMs)
  }

  /** Captions, sounds and particles for what the event just did. */
  react(news: EventNews): void {
    const { caption, shake } = this.fx
    if (news.type === 'call') return this.reactCall(news)
    if (news.type === 'eventStart') {
      if (news.id === 'leaf') sfx.play('wind', { volume: 0.45, pitch: 1.8 })
      if (news.id === 'sneeze') sfx.play('sneeze', { volume: 0.25, pitch: 1.6 })
      if (news.id === 'dog') sfx.play('bark')
      if (news.id === 'catAnkles') sfx.play('meow', { pitch: 1.2 })
      if (news.id === 'ring') this.lastRingAt = -1e9
      if (this.sim.state.event?.bathroom)
        caption.show(BATHROOM_LINES[news.id] ?? 'It followed you in.', 1200)
      return
    }
    if (news.type === 'eventMissed') {
      const lines = news.where === 'empty' ? EMPTY_LINES : MISSED_LINES
      caption.show(lines[news.id], 1100)
      return
    }
    const cat = news.id === 'catAnkles'
    switch (news.outcome) {
      case 'passed':
        if (cat) {
          this.catAt = this.nowMs
          this.catTripped = false
          caption.show('Bored now. Off it goes.', 1000)
          sfx.play('meow', { pitch: 0.8, volume: 0.6 })
          break
        }
        this.dogAt = this.nowMs
        this.dogTripped = false
        caption.show('Good dog.', 900)
        sfx.play('bark', { pitch: 1.3, volume: 0.7 })
        break
      case 'tripped':
        this.fx.fall()
        if (cat) {
          this.catAt = this.nowMs
          this.catTripped = true
          sfx.play('meow', { pitch: 1.5 })
          break
        }
        this.dogAt = this.nowMs
        this.dogTripped = true
        sfx.play('bark', { pitch: 1.2 })
        break
      case 'rubbed':
        shake.kick(1.5, 120)
        sfx.play('meow', { pitch: 0.6, volume: 0.2 })
        break
      case 'buzz':
        shake.kick(2, 150)
        sfx.play('buzz', { pitch: 0.55, volume: 0.6 })
        break
      case 'ignored':
        caption.show('Missed call.', 1000)
        break
      case 'blown':
        sfx.play('whoosh', { pitch: 1.3 })
        if (news.id === 'leaf') {
          caption.show('Off it goes.', 1000)
          this.flyOff(Kind.Leaf)
        } else {
          caption.show('Shoo.', 900)
        }
        break
      case 'returned':
        caption.show("It's back. Angrier.", 1100)
        sfx.play('buzz', { pitch: 1.5, volume: 0.7 })
        break
      case 'swatted':
        sfx.play('splat', { pitch: 1.4 })
        shake.kick(4, 160)
        if (news.id === 'leaf') {
          caption.show('Swatted. Leaf: flat.', 1000)
          this.flyOff(Kind.Leaf)
        } else {
          caption.show('Splat.', 1000)
          this.squash()
        }
        break
      case 'gaveUp':
        caption.show('Fine. Keep your water.', 1500)
        sfx.play('whoosh', { pitch: 0.8 })
        this.flyOff(Kind.Dust)
        break
      case 'landed':
        if (news.id === 'fly') sfx.play('splat', { volume: 0.6, pitch: 1.6 })
        break
      case 'sneezed':
        sfx.play('sneeze')
        shake.kick(8, 300)
        break
      case 'heldIn':
        caption.show('…choo.', 900)
        sfx.play('sneeze', { volume: 0.25, pitch: 1.8 })
        break
      case 'neverMind':
        caption.show('Ah… ah… never mind.', 1300)
        break
      default:
        break
    }
  }

  /** Answering, declining and your interview answer. */
  private reactCall(news: Extract<EventNews, { type: 'call' }>): void {
    const { caption } = this.fx
    if (news.what === 'answered') sfx.play('pop', { pitch: 1.2 })
    else if (news.what === 'declined') {
      caption.show(news.caller === 'mum' ? 'Sorry, Mum.' : 'Declined.', 900)
      sfx.play('click')
    } else {
      const answer = this.sim.state.calls.answer
      if (answer) caption.show(`"${answer}."`, 1400)
      sfx.play('ding', { pitch: 1.3, volume: 0.6 })
    }
  }

  /** The phone: a glow in your pocket and the caller's line, or the phone at your ear. */
  private drawCall(
    ctx: CanvasRenderingContext2D,
    event: CarryEvent,
    heroX: number,
    timeMs: number
  ): void {
    const caller = event.caller ?? 'mum'
    const talking = event.talkMs > 0
    let line = RINGING[caller]
    if (talking) {
      line =
        caller === 'interviewer'
          ? interviewQuestion(this.sim.state.calls.questions - 1).question
          : TALK_LINES[caller]
      // Wedged between your ear and your shoulder: your hands are busy.
      ctx.fillStyle = palette.ink
      ctx.beginPath()
      ctx.roundRect(heroX + 22, GROUND_Y - 222, 9, 22, 3)
      ctx.fill()
    } else {
      // The pocket lights up and shakes.
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(timeMs / 120))
      const jiggle = Math.sin(timeMs / 25) * 2
      ctx.fillStyle = palette.yellow
      ctx.globalAlpha = 0.35 + pulse * 0.5
      ctx.beginPath()
      ctx.arc(heroX - 6 + jiggle, GROUND_Y - 96, 10 + pulse * 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    drawSpeech(
      ctx,
      heroX + 192,
      GROUND_Y - 215,
      300,
      line,
      heroX + 34,
      GROUND_Y - 200
    )
  }

  /**
   * The dog: its head peeking in from behind while it barks, then a dash between your
   * legs, or a trip and a proud look back while the result shows.
   */
  private drawDogSide(
    ctx: CanvasRenderingContext2D,
    event: CarryEvent,
    heroX: number,
    timeMs: number
  ): void {
    if (event.stage === 'warning') {
      const t = Math.min(1, event.ms / event.warnMs)
      ctx.save()
      ctx.translate(heroX - 150 + t * 40, GROUND_Y - 4)
      ctx.scale(1.8, 1.8)
      drawDog(ctx, 0, 0, 1, 0, timeMs, true)
      ctx.restore()
      if (Math.sin(timeMs / 140) > 0)
        sketchText(
          ctx,
          'Woof!',
          heroX - 140,
          GROUND_Y - 70,
          boiled(WOOF, timeMs, 3.5)
        )
      return
    }
    const ms = this.nowMs - this.dogAt
    if (!this.dogTripped) {
      if (ms > DOG_PASS_MS) return
      const x = heroX - 140 + (ms / DOG_PASS_MS) * 640
      drawDog(ctx, x, GROUND_Y, 1, 1, timeMs)
      return
    }
    if (this.sim.state.phase !== 'drained') return
    // It stops just ahead and looks back at you, delighted with itself.
    const t = Math.min(1, ms / DOG_TRIP_MS)
    drawDog(
      ctx,
      heroX - 140 + t * 330,
      GROUND_Y,
      t < 1 ? 1 : -1,
      t < 1 ? 1 : 0,
      timeMs
    )
  }

  /** Remembers where the fly got swatted, so it can fall off the sieve, squashed. */
  private squash(): void {
    const event = this.sim.state.event
    if (!event || !eventSpot(event, this.spot)) return
    this.splat.x = this.spot.x
    this.splat.y = this.spot.y
    this.splatAt = this.nowMs
  }

  /** A squashed fly sliding off the sieve, legs up. */
  private drawSplat(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const ms = timeMs - this.splatAt
    if (ms < 0 || ms > SPLAT_MS) return
    const state = this.sim.state
    const t = ms / SPLAT_MS
    const x = CAM_X + state.grip.offsetX * CAM_OFFSET_SCALE + this.splat.x
    const y =
      CAM_Y + state.grip.offsetY * CAM_OFFSET_SCALE + this.splat.y + t * t * 160
    ctx.globalAlpha = 1 - t * t
    ctx.fillStyle = palette.ink
    ctx.beginPath()
    ctx.ellipse(x, y, 11, 3.5, 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (const dx of [-6, -1, 4]) {
      ctx.moveTo(x + dx, y + 2)
      ctx.lineTo(x + dx - 2, y + 9)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  /**
   * The cat in the bathroom: trotting in from behind you, then weaving round your ankles,
   * then strolling off, or sitting by you, smug, after it tripped you.
   */
  private drawAnkleCat(
    ctx: CanvasRenderingContext2D,
    event: CarryEvent,
    heroX: number,
    timeMs: number
  ): void {
    const cat = this.cat
    cat.timeMs = timeMs
    cat.puff = 0
    cat.paw = 0
    cat.lap = 0
    if (event.stage === 'warning') {
      if (event.ms < event.warnMs) {
        const t = event.ms / event.warnMs
        cat.facing = 1
        cat.stride = (timeMs / 140) % 1
        drawCat(ctx, heroX - 250 + t * 220, GROUND_Y + 6, cat)
        if (Math.sin(timeMs / 160) > 0.2)
          sketchText(
            ctx,
            'Mrrp?',
            heroX - 230 + t * 220,
            GROUND_Y - 80,
            boiled(MRRP, timeMs, 3)
          )
        return
      }
      // Round and round your ankles, tail up.
      const weave = (event.ms - event.warnMs) / ANKLE_WEAVE_MS
      const swing = Math.sin(weave * Math.PI * 4)
      cat.facing = Math.cos(weave * Math.PI * 4) > 0 ? 1 : -1
      cat.stride = (timeMs / 120) % 1
      drawCat(ctx, heroX + swing * 38, GROUND_Y + 6, cat)
      if (Math.sin(timeMs / 200) > 0)
        sketchText(
          ctx,
          'purr',
          heroX + 60,
          GROUND_Y - 70,
          boiled(PURR, timeMs, 2.5)
        )
      return
    }
    const ms = this.nowMs - this.catAt
    if (this.catTripped) {
      if (this.sim.state.phase !== 'drained') return
      // It sits right where you fell, licking a paw.
      cat.facing = -1
      cat.paw = 0.5 + 0.5 * Math.sin(timeMs / 180)
      drawCat(ctx, heroX + 70, GROUND_Y + 6, cat)
      return
    }
    if (ms > 1200) return
    cat.facing = 1
    cat.stride = (timeMs / 140) % 1
    drawCat(ctx, heroX + 30 + (ms / 1200) * 400, GROUND_Y + 6, cat)
  }

  /** The cat's warning on the ring's left side, like the dog's. */
  private drawRingCat(
    ctx: CanvasRenderingContext2D,
    event: CarryEvent,
    timeMs: number
  ): void {
    if (event.ms >= event.warnMs + ANKLE_WEAVE_MS) return
    const near = Math.min(1, event.ms / event.warnMs)
    const x = CAM_X - RING_RADIUS - 26 + near * 10
    const cat = this.cat
    cat.facing = 1
    cat.stride = 0
    cat.timeMs = timeMs
    ctx.save()
    ctx.translate(x, CAM_Y + 22)
    ctx.scale(0.8, 0.8)
    drawCat(ctx, 0, 0, cat)
    ctx.restore()
    ctx.strokeStyle = palette.red
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(timeMs / 110))
    ctx.beginPath()
    ctx.arc(x, CAM_Y, 30, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  /** The blown leaf or fly flies off out of the cam. */
  private flyOff(kind: Kind): void {
    const state = this.sim.state
    const event = state.event
    if (!event) return
    const spot = eventSpot(event, this.spot)
    if (!spot) return
    this.fx.cam.spawn(
      kind,
      CAM_X + state.grip.offsetX * CAM_OFFSET_SCALE + spot.x,
      CAM_Y + state.grip.offsetY * CAM_OFFSET_SCALE + spot.y,
      event.side * 700,
      -260,
      700
    )
  }
}

/** "Mum: Are you drinking enough water?", built once per caller. */
const RINGING: Record<Caller, string> = {
  interviewer: `${CALLER_NAME.interviewer}: ${RING_LINES.interviewer}`,
  mum: `${CALLER_NAME.mum}: ${RING_LINES.mum}`,
  scam: `${CALLER_NAME.scam}: ${RING_LINES.scam}`,
  water: `${CALLER_NAME.water}: ${RING_LINES.water}`
}

// Sound words drawn every frame, hoisted so drawing allocates nothing. Each boils.
const BZZ: SketchTextStyle = { size: 18, tilt: 0.3, color: palette.inkSoft }
const WOOF: SketchTextStyle = {
  font: 'marker',
  size: 22,
  tilt: 0.2,
  outline: palette.paper
}
const MRRP: SketchTextStyle = { size: 20, tilt: 0.2, color: palette.inkSoft }
const PURR: SketchTextStyle = { size: 18, tilt: 0.25, color: palette.inkSoft }

/** Sets a text style's seed to boil at `fps`, and returns it. */
function boiled(
  style: SketchTextStyle,
  timeMs: number,
  fps: number
): SketchTextStyle {
  style.seed = boilSeed(timeMs, fps)
  return style
}

const SWATTER_HANDLE: SketchStyle = {
  color: palette.red,
  width: 7,
  passes: 1,
  wobble: 1
}
const SWATTER_MESH: SketchStyle = {
  fill: 'rgba(201, 42, 42, 0.3)',
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.red,
  width: 3,
  wobble: 1.5,
  seed: 520
}

/**
 * How far the swatter has come down: 0 wound up, 1 on target. It slaps down in the first
 * third of the swing and stays there.
 */
function swingProgress(swingMs: number): number {
  const t = Math.min(1, (1 - swingMs / SWING_MS) / 0.35)
  return t * t
}

/** Seen from above: the swatter slaps down across the sieve from the bottom left. */
function drawCamSwing(ctx: CanvasRenderingContext2D, swingMs: number): void {
  const t = swingProgress(swingMs)
  ctx.save()
  ctx.translate(CAM_X - 200, CAM_Y + 210)
  // From off to the left, round onto the middle of the sieve.
  ctx.rotate(-1.1 + t * 1.86)
  SWATTER_HANDLE.seed = 521
  sketchLine(ctx, 0, 0, 0, -170, SWATTER_HANDLE)
  sketchRoundRect(ctx, -55, -300, 110, 130, 14, SWATTER_MESH)
  ctx.restore()
}

/** Side view: the swatter whips over your head and down at the sieve. */
function drawSideSwing(
  ctx: CanvasRenderingContext2D,
  heroX: number,
  swingMs: number
): void {
  const t = swingProgress(swingMs)
  ctx.save()
  ctx.translate(heroX + 14, GROUND_Y - 150)
  // From over your head, down onto the sieve in your hands.
  ctx.rotate(-0.6 + t * 2.45)
  SWATTER_HANDLE.seed = 522
  sketchLine(ctx, 0, 0, 0, -60, SWATTER_HANDLE)
  sketchRoundRect(ctx, -16, -104, 32, 44, 6, SWATTER_MESH)
  ctx.restore()
}

/** The landing shadow: darker and wider as touchdown nears, ringed in pulsing red. */
function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  event: CarryEvent,
  timeMs: number
): void {
  const near = 1 - (event.warnMs - event.ms) / event.shadowMs
  const r = (event.id === 'fly' ? 6 : 12) + near * 12
  ctx.fillStyle = palette.ink
  ctx.globalAlpha = 0.12 + near * 0.3
  ctx.beginPath()
  ctx.ellipse(x, y, r * 1.6, r, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = palette.red
  ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(timeMs / 90))
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(x, y, r * 1.6 + 6, r + 6, 0.3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** A housefly: an ink body with buzzing see-through wings, red-eyed once it's angry. */
function drawFly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  angry: boolean,
  timeMs: number
): void {
  const flap = 0.5 + 0.5 * Math.abs(Math.sin(timeMs / 16))
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.strokeStyle = palette.inkSoft
  ctx.lineWidth = 1.5
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(
      x + dir * 5 * scale,
      y - 5 * scale,
      7 * scale,
      4.5 * scale * flap,
      dir * 0.5,
      0,
      Math.PI * 2
    )
    ctx.fill()
    ctx.stroke()
  }
  ctx.fillStyle = palette.ink
  ctx.beginPath()
  ctx.ellipse(x, y, 6 * scale, 4.5 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  if (!angry) return
  ctx.fillStyle = palette.red
  ctx.beginPath()
  ctx.arc(x + 4 * scale, y - 1.5 * scale, 1.8 * scale, 0, Math.PI * 2)
  ctx.arc(x - 1 * scale, y - 2 * scale, 1.8 * scale, 0, Math.PI * 2)
  ctx.fill()
}

/** What happens to an event the house kept out. */
const MISSED_LINES: Record<CarryEvent['id'], string> = {
  leaf: 'The roof got it.',
  fly: 'It stayed outside.',
  dog: 'The dog stayed outside.',
  sneeze: 'Ah… ah… never mind.',
  ring: 'Missed call.',
  catAnkles: 'The cat lost interest.'
}

/** What happens to an event still going when the pour empties the sieve. */
const EMPTY_LINES: Record<CarryEvent['id'], string> = {
  leaf: 'Nothing left to land in.',
  fly: 'Too late, fly. All poured.',
  dog: 'The dog stayed outside.',
  sneeze: 'Achoo. Into an empty sieve.',
  ring: 'Missed call.',
  catAnkles: 'The cat lost interest.'
}

/** The caption as a threat follows you into the bathroom. */
const BATHROOM_LINES: Partial<Record<CarryEvent['id'], string>> = {
  fly: 'A fly. Through the door.',
  catAnkles: 'The cat. Round your ankles.',
  sneeze: 'Bath dust. Ah…'
}

/** The dog's head on the ring's left side, so you see it coming where you look. */
function drawRingDog(
  ctx: CanvasRenderingContext2D,
  event: CarryEvent,
  timeMs: number
): void {
  const near = Math.min(1, event.ms / event.warnMs)
  const x = CAM_X - RING_RADIUS - 24 + near * 10
  ctx.save()
  ctx.translate(x, CAM_Y + 18)
  ctx.scale(1.3, 1.3)
  drawDog(ctx, 0, 0, 1, 0, timeMs, true)
  ctx.restore()
  ctx.strokeStyle = palette.red
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(timeMs / 110))
  ctx.beginPath()
  ctx.arc(x, CAM_Y, 28, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}
