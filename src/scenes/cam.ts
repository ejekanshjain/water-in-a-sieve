import { gaitScale } from '../game/kit'
import {
  nextBumpAhead,
  nextPatchAhead,
  nextRoseAhead,
  pavedAt,
  SEGMENT_COUNT
} from '../game/path'
import { sieveWeight } from '../game/sieve'
import type { GameState } from '../game/sim'
import { predictedBumpLevel } from '../game/steadiness'
import {
  BIG_SIEVE_ART,
  BREAK_LEVEL,
  CAM_OFFSET_SCALE,
  CAM_RADIUS,
  CAM_X,
  CAM_Y,
  PATH_METRES,
  PAVED_GAIT,
  RING_RADIUS,
  ROSE_FROM_M,
  ROSE_TO_M,
  SEGMENT_M,
  WARN_AHEAD_M,
  WAX_TRIPS
} from '../game/tuning'
import {
  CachedLayer,
  palette,
  settings,
  sketchCircle,
  sketchLine,
  sketchText,
  type Viewport
} from '../shared'
import {
  drawGloss,
  drawHole,
  drawRingFill,
  drawSieveCentre,
  drawSieveWater,
  drawTargetDot,
  drawTiltWedge,
  paintRingFrame,
  paintSieve,
  ringAngle,
  ringRect,
  SIEVE_RADIUS,
  SIEVE_RECT
} from './art/sieve'

const BAR_LEFT = 60
const BAR_RIGHT = 480
const BAR_Y = 150
const MARKER = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2.5,
  wobble: 1
}

/**
 * The top of the play area in every scene: the distance bar, and the sieve cam with the
 * steadiness ring around it. Drawn on the canvas, so replays and share stills show it.
 */
export class SieveCam {
  readonly layers: CachedLayer[]
  private readonly sieve: CachedLayer
  private readonly fineSieve: CachedLayer
  private readonly ringFrame: CachedLayer
  private readonly bar: CachedLayer
  /** How squashed the sieve is right now, about -0.1 to 0.1; the renderer sets it per frame. */
  squash = 0
  /** The ghost tick's scales, reused every frame. */
  private readonly bumpScales = { weight: 1, gaitScale: 1 }

  constructor(viewport: Viewport) {
    this.sieve = new CachedLayer(viewport, ctx => paintSieve(ctx), SIEVE_RECT)
    this.fineSieve = new CachedLayer(
      viewport,
      ctx => paintSieve(ctx, true),
      SIEVE_RECT
    )
    this.ringFrame = new CachedLayer(
      viewport,
      ctx => paintRingFrame(ctx, RING_RADIUS),
      ringRect(RING_RADIUS)
    )
    this.bar = new CachedLayer(viewport, paintDistanceBar, {
      x: 20,
      y: 116,
      width: 500,
      height: 60
    })
    this.layers = [this.sieve, this.fineSieve, this.ringFrame, this.bar]
  }

  /** Repaints cached art, for example once fonts load. */
  invalidate(): void {
    for (const layer of this.layers) layer.invalidate()
  }

  dispose(): void {
    for (const layer of this.layers) layer.dispose()
  }

  /**
   * Draws the bar and the cam. `barMetres` places the marker on the distance bar.
   * `background` paints inside the round cam window, in logical units; `showSieve` hides
   * the sieve while it hangs on its hook.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number,
    flash: number,
    barMetres: number,
    background: (ctx: CanvasRenderingContext2D) => void,
    showSieve: boolean
  ): void {
    const d = barMetres
    this.bar.draw(ctx)
    const markerX = barX(d)
    this.drawBarHazards(ctx, state)
    sketchCircle(ctx, markerX, BAR_Y, 9, MARKER)

    ctx.save()
    ctx.beginPath()
    ctx.arc(CAM_X, CAM_Y, CAM_RADIUS, 0, Math.PI * 2)
    ctx.clip()
    background(ctx)
    if (showSieve) this.drawSieve(ctx, state, timeMs)
    ctx.restore()

    ctx.save()
    ctx.translate(CAM_X, CAM_Y)
    this.ringFrame.draw(ctx)
    ctx.restore()
    drawRingFill(
      ctx,
      CAM_X,
      CAM_Y,
      RING_RADIUS,
      state.steady.total,
      state.steady.zone,
      flash
    )
    if (state.scene === 'path' && state.phase === 'carry')
      this.drawRingHazards(ctx, state)
  }

  /** Bumps as red ticks and puddles as blue dots on the distance bar. */
  private drawBarHazards(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const path = state.path
    // Paved stretches as grey bands under the bar.
    ctx.fillStyle = '#a8a29a'
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      if (!path.stones[i]) continue
      const from = barX(i * SEGMENT_M)
      ctx.fillRect(from, BAR_Y + 3, barX((i + 1) * SEGMENT_M) - from, 5)
    }
    ctx.fillStyle = palette.red
    for (const b of path.bumps) {
      const x = barX(b)
      ctx.beginPath()
      ctx.moveTo(x - 6, BAR_Y - 6)
      ctx.lineTo(x + 6, BAR_Y - 6)
      ctx.lineTo(x, BAR_Y + 4)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = palette.blue
    for (const patch of path.patches) {
      ctx.beginPath()
      ctx.arc(barX(patch.at), BAR_Y + 8, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    if (path.rose) {
      // The rose bush: a thorny green stretch with a pink bloom.
      ctx.strokeStyle = palette.green
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(barX(ROSE_FROM_M), BAR_Y)
      ctx.lineTo(barX(ROSE_TO_M), BAR_Y)
      ctx.stroke()
      ctx.fillStyle = palette.pink
      ctx.beginPath()
      ctx.arc(barX((ROSE_FROM_M + ROSE_TO_M) / 2), BAR_Y - 8, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /**
   * Within 12 m of a bump, a ghost tick shows the level you'd hit at this speed (red if it
   * would break) and a red arrow climbs the right rim. Puddles climb the left rim in blue.
   */
  private drawRingHazards(
    ctx: CanvasRenderingContext2D,
    state: GameState
  ): void {
    const at = state.walker.distance
    const bump = nextBumpAhead(state.path, at)
    if (bump <= WARN_AHEAD_M) {
      const pavedHere = pavedAt(state.path, at)
      const scales = this.bumpScales
      scales.weight = sieveWeight(state.gear)
      // Walking for real, the phone reads your gait itself, so only the bump counts.
      scales.gaitScale = state.realWalk.active
        ? 0
        : gaitScale(state.kit.slippers) * (pavedHere ? PAVED_GAIT : 1)
      const level = predictedBumpLevel(
        state.steady.hand,
        state.walker.speed,
        settings.get().assist,
        scales
      )
      const angle = ringAngle(level)
      const danger = level >= BREAK_LEVEL
      ctx.lineCap = 'round'
      ctx.strokeStyle = palette.paper
      ctx.lineWidth = 9
      radial(ctx, angle, RING_RADIUS - 13, RING_RADIUS + 13)
      ctx.strokeStyle = danger ? palette.red : palette.ink
      ctx.lineWidth = 5
      radial(ctx, angle, RING_RADIUS - 12, RING_RADIUS + 12)
      const climb = Math.PI / 2 - (1 - bump / WARN_AHEAD_M) * Math.PI
      rimArrow(ctx, climb, palette.red)
    }
    const puddle = nextPatchAhead(state.path, at, 1)
    if (puddle <= WARN_AHEAD_M) {
      const climb = Math.PI / 2 + (1 - puddle / WARN_AHEAD_M) * Math.PI
      rimArrow(ctx, climb, palette.blue)
    }
    const rose = nextRoseAhead(state.path, at)
    if (rose <= WARN_AHEAD_M) {
      const climb = Math.PI / 2 + (1 - rose / WARN_AHEAD_M) * Math.PI
      rimArrow(ctx, climb, palette.pink)
    }
  }

  private drawSieve(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    drawTargetDot(ctx, CAM_X, CAM_Y)
    const grip = state.grip
    const sx = CAM_X + grip.offsetX * CAM_OFFSET_SCALE
    const sy = CAM_Y + grip.offsetY * CAM_OFFSET_SCALE
    // The Bigger Sieve fills the cam: everything on it scales around its centre. A jolt
    // squashes it wide and flat for a moment.
    const k = state.gear.biggerSieve ? BIG_SIEVE_ART : 1
    ctx.save()
    ctx.translate(sx, sy)
    ctx.scale(k * (1 + this.squash), k * (1 - this.squash))
    ;(state.gear.finerMesh ? this.fineSieve : this.sieve).draw(ctx)
    ctx.translate(-sx, -sy)
    const fill = state.sieve.inSieve / (state.capacityMl || 1)
    const tilt = Math.min(1, state.tiltDeg / 30)
    const len = Math.hypot(grip.offsetX, grip.offsetY) || 1
    const dirX = grip.offsetX / len
    const dirY = grip.offsetY / len
    drawSieveWater(
      ctx,
      sx,
      sy,
      fill,
      dirX * tilt * 22,
      dirY * tilt * 22,
      Math.min(1, state.steady.total),
      timeMs
    )
    // Wax glints on the mesh, fading as it wears.
    if (state.gear.wax)
      drawGloss(
        ctx,
        sx,
        sy,
        SIEVE_RADIUS - 8,
        0.3 + (0.7 * state.kit.waxTripsLeft) / WAX_TRIPS,
        2.5
      )
    for (const hole of state.holes) {
      const r = hole.dist * (SIEVE_RADIUS - 10)
      drawHole(
        ctx,
        sx + Math.cos(hole.angle) * r,
        sy + Math.sin(hole.angle) * r,
        hole.seed,
        hole.stitched,
        hole.points
      )
    }
    if (state.dribbling) drawTiltWedge(ctx, sx, sy, dirX, dirY, tilt)
    drawSieveCentre(ctx, sx, sy)
    ctx.restore()
  }
}

function barX(metres: number): number {
  const clamped = Math.max(0, Math.min(metres, PATH_METRES))
  return BAR_LEFT + (clamped / PATH_METRES) * (BAR_RIGHT - BAR_LEFT)
}

/** A short line across the ring at `angle`, between two radii. */
function radial(
  ctx: CanvasRenderingContext2D,
  angle: number,
  inner: number,
  outer: number
): void {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  ctx.beginPath()
  ctx.moveTo(CAM_X + c * inner, CAM_Y + s * inner)
  ctx.lineTo(CAM_X + c * outer, CAM_Y + s * outer)
  ctx.stroke()
}

/** A small arrowhead outside the ring at `angle`, pointing in. */
function rimArrow(
  ctx: CanvasRenderingContext2D,
  angle: number,
  color: string
): void {
  const r = RING_RADIUS + 16
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const tipX = CAM_X + c * r
  const tipY = CAM_Y + s * r
  const backX = CAM_X + c * (r + 16)
  const backY = CAM_Y + s * (r + 16)
  ctx.fillStyle = color
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(backX - s * 9, backY + c * 9)
  ctx.lineTo(backX + s * 9, backY - c * 9)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function paintDistanceBar(ctx: CanvasRenderingContext2D): void {
  sketchLine(ctx, BAR_LEFT, BAR_Y, BAR_RIGHT, BAR_Y, { width: 4, seed: 41 })
  for (const m of [25, 50, 75]) {
    const x = BAR_LEFT + (m / PATH_METRES) * (BAR_RIGHT - BAR_LEFT)
    sketchLine(ctx, x, BAR_Y - 7, x, BAR_Y + 7, { width: 2, seed: 42 + m })
  }
  sketchText(ctx, 'Well', BAR_LEFT - 2, BAR_Y - 22, { size: 18, align: 'left' })
  sketchText(ctx, 'House', BAR_RIGHT + 2, BAR_Y - 22, {
    size: 18,
    align: 'right'
  })
  sketchText(ctx, '100 m', BAR_RIGHT + 2, BAR_Y + 18, {
    size: 15,
    align: 'right',
    color: palette.inkSoft
  })
}
