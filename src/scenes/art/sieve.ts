import { BREAK_LEVEL, RING_MAX, SLOSH_LEVEL } from '../../game/tuning'
import type { Zone } from '../../game/types'
import {
  hash01,
  palette,
  sketchCircle,
  sketchLine,
  sketchPolygon,
  sketchRoundRect,
  type LayerRect,
  type SketchStyle
} from '../../shared'

/** Top-down sieve radius in the cam. */
export const SIEVE_RADIUS = 78
/** Stamp rect for the top-down sieve, centred on (0, 0); the handle points down-right. */
export const SIEVE_RECT: LayerRect = {
  x: -105,
  y: -105,
  width: 230,
  height: 230
}

const MESH: SketchStyle = {
  fill: 'rgba(120, 120, 120, 0.28)',
  fillStyle: 'hatch',
  hatchGap: 7,
  hatchAngle: 0.8,
  color: palette.inkSoft,
  width: 1.5,
  wobble: 1.5,
  seed: 21
}
const MESH_CROSS: SketchStyle = {
  ...MESH,
  hatchAngle: -0.8,
  seed: 22,
  width: 0
}
const RIM: SketchStyle = { color: '#9a6a3a', width: 7, wobble: 2, seed: 23 }
const RIM_LINE: SketchStyle = {
  color: palette.ink,
  width: 2.5,
  wobble: 2,
  seed: 24
}
const HANDLE: SketchStyle = {
  fill: '#c08a55',
  color: palette.ink,
  width: 2.5,
  wobble: 1.5,
  seed: 25
}

/** Finer Mesh crosses its two hatch passes much closer together. */
const FINE_MESH: SketchStyle = { ...MESH, hatchGap: 4 }
const FINE_MESH_CROSS: SketchStyle = { ...MESH_CROSS, hatchGap: 4 }

/** Paints the top-down sieve: mesh (finer with Finer Mesh), wooden rim and handle. */
export function paintSieve(ctx: CanvasRenderingContext2D, fine = false): void {
  ctx.save()
  ctx.translate(SIEVE_RADIUS * 0.72, SIEVE_RADIUS * 0.72)
  ctx.rotate(Math.PI / 4)
  sketchRoundRect(ctx, 0, -9, 62, 18, 8, HANDLE)
  ctx.restore()
  sketchCircle(ctx, 0, 0, SIEVE_RADIUS - 4, fine ? FINE_MESH : MESH)
  sketchCircle(ctx, 0, 0, SIEVE_RADIUS - 4, fine ? FINE_MESH_CROSS : MESH_CROSS)
  sketchCircle(ctx, 0, 0, SIEVE_RADIUS, RIM)
  sketchCircle(ctx, 0, 0, SIEVE_RADIUS + 4, RIM_LINE)
  sketchCircle(ctx, 0, 0, SIEVE_RADIUS - 5, {
    ...RIM_LINE,
    width: 1.5,
    seed: 26
  })
}

const WATER = 'rgba(116, 192, 252, 0.72)'
const WATER_DEEP = 'rgba(24, 100, 171, 0.35)'

/**
 * Draws the water in the top-down sieve at (cx, cy). `fill` is 0 to 1. The surface slides
 * toward the low side by `leanX`, `leanY` (units), and ripples with `ripple` (0 to 1).
 */
export function drawSieveWater(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  fill: number,
  leanX: number,
  leanY: number,
  ripple: number,
  timeMs: number
): void {
  if (fill <= 0.001) return
  const r = (SIEVE_RADIUS - 8) * Math.sqrt(Math.min(1, fill))
  const wx = cx + leanX
  const wy = cy + leanY
  const wave = ripple * 4 * Math.sin(timeMs / 60)
  ctx.fillStyle = WATER
  ctx.beginPath()
  ctx.ellipse(wx, wy, r + wave, r - wave, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = WATER_DEEP
  ctx.beginPath()
  ctx.ellipse(
    wx + leanX * 0.3,
    wy + leanY * 0.3,
    r * 0.55,
    r * 0.55,
    0,
    0,
    Math.PI * 2
  )
  ctx.fill()
  // Highlights that wobble a little, like light on water.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  const t = timeMs / 400
  ctx.beginPath()
  ctx.arc(wx - r * 0.25, wy - r * 0.3, r * 0.45, 3.6 + Math.sin(t) * 0.1, 4.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(wx + r * 0.2, wy + r * 0.25, r * 0.3, 0.3, 0.9 + Math.cos(t) * 0.1)
  ctx.stroke()
}

/** A fully waxed sieve shows this many gloss streaks. */
const GLOSS_STREAKS = 10

/**
 * White gloss streaks over a waxed sieve: `amount` 0 to 1 shows that share of them, at
 * fixed spots inside `radius` of (cx, cy). The cam and the bench both use it.
 */
export function drawGloss(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  amount: number,
  width: number
): void {
  const count = Math.round(GLOSS_STREAKS * Math.min(1, amount))
  if (count <= 0) return
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < count; i++) {
    const a = hash01(31, i) * Math.PI * 2
    const r = Math.sqrt(hash01(32, i)) * radius * 0.8
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    const len = radius * (0.12 + 0.12 * hash01(33, i))
    ctx.moveTo(x - len, y + len * 0.4)
    ctx.lineTo(x + len, y - len * 0.4)
  }
  ctx.stroke()
}

/** Red wedge on the rim's low side while the sieve dribbles. `strength` 0 to 1. */
export function drawTiltWedge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dirX: number,
  dirY: number,
  strength: number
): void {
  if (strength <= 0) return
  const angle = Math.atan2(dirY, dirX)
  const spread = 0.35 + 0.35 * strength
  ctx.strokeStyle = palette.red
  ctx.globalAlpha = 0.55 + 0.45 * strength
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, SIEVE_RADIUS + 2, angle - spread, angle + spread)
  ctx.stroke()
  ctx.globalAlpha = 1
}

const HOLE: SketchStyle = {
  fill: '#fdf6e3',
  color: palette.ink,
  width: 2,
  wobble: 1
}
const holePoints = new Float64Array(24)

/**
 * A torn hole in the mesh at (x, y): a jagged gap with frayed wire ends. Sewn stitches
 * (`stitched` of `points`) cross it in red thread.
 */
export function drawHole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
  stitched: number,
  points: number
): void {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const r = (i % 2 === 0 ? 13 : 7) * (0.8 + hash01(seed, i) * 0.5)
    holePoints[i * 2] = x + Math.cos(a) * r
    holePoints[i * 2 + 1] = y + Math.sin(a) * r
  }
  HOLE.seed = seed
  sketchPolygon(ctx, holePoints, HOLE)
  ctx.strokeStyle = palette.inkSoft
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < 12; i += 2) {
    const px = holePoints[i * 2] ?? x
    const py = holePoints[i * 2 + 1] ?? y
    ctx.moveTo(px, py)
    ctx.lineTo(x + (px - x) * 0.55, y + (py - y) * 0.55)
  }
  ctx.stroke()
  if (stitched <= 0) return
  ctx.strokeStyle = palette.red
  ctx.lineWidth = 2.5
  ctx.beginPath()
  for (let i = 0; i < stitched; i++) {
    const sy = y - 10 + (20 * (i + 0.5)) / Math.max(1, points)
    ctx.moveTo(x - 12, sy - 3)
    ctx.lineTo(x + 12, sy + 3)
  }
  ctx.stroke()
}

/** The dot where your hands want the sieve, at the cam centre. */
export function drawTargetDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
): void {
  ctx.fillStyle = palette.ink
  ctx.beginPath()
  ctx.arc(cx, cy, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, 16, 0, Math.PI * 2)
  ctx.stroke()
}

/** Marks the sieve's centre so you can line it up with the dot. */
export function drawSieveCentre(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  ctx.strokeStyle = palette.blue
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x - 9, y)
  ctx.lineTo(x + 9, y)
  ctx.moveTo(x, y - 9)
  ctx.lineTo(x, y + 9)
  ctx.stroke()
}

// ---------------------------------------------------------------- Steadiness ring

/** Stamp rect for the ring frame, centred on (0, 0). */
export function ringRect(radius: number): LayerRect {
  const r = radius + 24
  return { x: -r, y: -r, width: r * 2, height: r * 2 }
}

const RING_EDGE: SketchStyle = { color: palette.ink, width: 2.5, wobble: 1.5 }
const RING_WIDTH = 14

/** Angle on the ring for a level, clockwise from the top. */
export function ringAngle(level: number): number {
  return -Math.PI / 2 + (Math.min(level, RING_MAX) / RING_MAX) * Math.PI * 2
}

/** Paints the static ring: inner and outer edges, zone ticks and the red limit notch. */
export function paintRingFrame(
  ctx: CanvasRenderingContext2D,
  radius: number
): void {
  ctx.strokeStyle = palette.paperDark
  ctx.lineWidth = RING_WIDTH
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.stroke()
  RING_EDGE.seed = 31
  sketchCircle(ctx, 0, 0, radius - RING_WIDTH / 2 - 1, RING_EDGE)
  RING_EDGE.seed = 32
  sketchCircle(ctx, 0, 0, radius + RING_WIDTH / 2 + 1, RING_EDGE)
  const slosh = ringAngle(SLOSH_LEVEL)
  sketchLine(
    ctx,
    Math.cos(slosh) * (radius - 9),
    Math.sin(slosh) * (radius - 9),
    Math.cos(slosh) * (radius + 9),
    Math.sin(slosh) * (radius + 9),
    { color: palette.inkSoft, width: 2, wobble: 1 }
  )
  const limit = ringAngle(BREAK_LEVEL)
  sketchLine(
    ctx,
    Math.cos(limit) * (radius - 16),
    Math.sin(limit) * (radius - 16),
    Math.cos(limit) * (radius + 18),
    Math.sin(limit) * (radius + 18),
    { color: palette.red, width: 6, wobble: 1.5, seed: 33 }
  )
}

const ZONE_COLORS: Record<Zone, string> = {
  green: '#4caf5d',
  slosh: '#f2a516',
  break: palette.red
}

/** Draws the live fill of the ring for `total`, flashing red after a break. */
export function drawRingFill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  total: number,
  zone: Zone,
  flash: number
): void {
  const end = ringAngle(Math.max(0.02, total))
  ctx.lineCap = 'round'
  ctx.lineWidth = RING_WIDTH - 4
  ctx.strokeStyle = flash > 0 ? palette.red : ZONE_COLORS[zone]
  ctx.beginPath()
  ctx.arc(cx, cy, radius, -Math.PI / 2, end)
  ctx.stroke()
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.5
    ctx.lineWidth = RING_WIDTH + 10
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

/** Bubble level radius in the cam corner, in logical units. */
export const LEVEL_RADIUS = 30

/**
 * A round bubble level for phone play. The bubble floats to the high side; past the
 * inner ring the sieve dribbles, and at the rim it tips.
 */
export function drawBubbleLevel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tiltX: number,
  tiltY: number,
  dribbleDeg: number,
  tipDeg: number
): void {
  const tilt = Math.hypot(tiltX, tiltY)
  const reach = Math.min(1, tilt / tipDeg) * (LEVEL_RADIUS - 9)
  const scale = tilt > 0 ? reach / tilt : 0
  const bx = cx - tiltX * scale
  const by = cy - tiltY * scale
  ctx.fillStyle = 'rgba(214, 236, 251, 0.95)'
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, LEVEL_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = palette.inkSoft
  ctx.beginPath()
  ctx.arc(
    cx,
    cy,
    (dribbleDeg / tipDeg) * (LEVEL_RADIUS - 9) + 9,
    0,
    Math.PI * 2
  )
  ctx.stroke()
  ctx.fillStyle =
    tilt >= tipDeg * 0.85
      ? palette.red
      : tilt > dribbleDeg
        ? palette.yellow
        : palette.green
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(bx, by, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}
