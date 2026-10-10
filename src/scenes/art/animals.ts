import {
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  type SketchStyle
} from '../../shared'

/** What the cat is doing this frame. */
export interface CatPose {
  /** 1 faces right, -1 faces left. */
  facing: 1 | -1
  /** Walk cycle phase 0 to 1; 0 when standing. */
  stride: number
  /** Puffed into a spiky ball of outrage, 0 to 1. */
  puff: number
  /** Front paw reaching out, 0 to 1. */
  paw: number
  /** Tongue out, lapping, 0 to 1. */
  lap?: number
  timeMs: number
}

const FUR: SketchStyle = {
  fill: palette.orange,
  color: palette.ink,
  width: 2.5,
  wobble: 1.5
}
const STRIPES: SketchStyle = {
  fill: 'rgba(120, 60, 10, 0.55)',
  fillStyle: 'hatch',
  hatchGap: 7,
  hatchAngle: 1.2,
  width: 0,
  wobble: 1
}
const LEG: SketchStyle = { color: palette.ink, width: 5, passes: 1, wobble: 1 }
const TAIL: SketchStyle & { smooth: boolean } = {
  color: palette.orange,
  width: 7,
  passes: 1,
  wobble: 1.5,
  smooth: true
}
const tailPoints = new Float64Array(8)
const earPoints = new Float64Array(6)
const puffPoints = new Float64Array(36)

/**
 * The orange tabby, side view, standing on (x, y). Half-closed eyes, a curled tail, and
 * when outraged it puffs into a spiky blob.
 */
export function drawCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: CatPose
): void {
  ctx.save()
  ctx.translate(x, y)
  if (pose.facing < 0) ctx.scale(-1, 1)
  const swing = Math.sin(pose.stride * Math.PI * 2) * 8
  const bodyY = -34
  // Legs, then the tail curling up behind.
  LEG.seed = 301
  sketchLine(ctx, -20, bodyY + 8, -22 + swing, 0, LEG)
  LEG.seed = 302
  sketchLine(ctx, 18, bodyY + 8, 20 - swing - pose.paw * 4, 0, LEG)
  tailPoints[0] = -30
  tailPoints[1] = bodyY
  tailPoints[2] = -50
  tailPoints[3] = bodyY - 14
  tailPoints[4] = -46
  tailPoints[5] = bodyY - 40 - pose.puff * 10
  tailPoints[6] = -36 + Math.sin(pose.timeMs / 300) * 4
  tailPoints[7] = bodyY - 48 - pose.puff * 14
  TAIL.seed = 303
  TAIL.width = 7 + pose.puff * 6
  sketchPath(ctx, tailPoints, TAIL)
  if (pose.puff > 0.05) {
    // Every hair on end: a star of spikes.
    const r = 30 + pose.puff * 10
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const k = i % 2 === 0 ? 1.35 : 1
      puffPoints[i * 2] = Math.cos(a) * r * k
      puffPoints[i * 2 + 1] = bodyY + Math.sin(a) * r * k * 0.7
    }
    FUR.seed = 305
    sketchPolygon(ctx, puffPoints, FUR)
  } else {
    FUR.seed = 306
    sketchEllipse(ctx, 0, bodyY, 34, 17, FUR)
    STRIPES.seed = 307
    sketchEllipse(ctx, 0, bodyY, 28, 13, STRIPES)
  }
  // The reaching paw.
  if (pose.paw > 0) {
    LEG.seed = 308
    sketchLine(ctx, 22, bodyY, 22 + pose.paw * 28, bodyY - pose.paw * 6, LEG)
  }
  // Head with ears and sleepy, unimpressed eyes.
  const hx = 34
  const hy = bodyY - 18 - pose.puff * 6
  earPoints[0] = hx - 12
  earPoints[1] = hy - 8
  earPoints[2] = hx - 8
  earPoints[3] = hy - 26
  earPoints[4] = hx
  earPoints[5] = hy - 12
  FUR.seed = 309
  sketchPolygon(ctx, earPoints, FUR)
  earPoints[0] = hx + 2
  earPoints[2] = hx + 10
  earPoints[4] = hx + 14
  FUR.seed = 310
  sketchPolygon(ctx, earPoints, FUR)
  FUR.seed = 311
  sketchCircle(ctx, hx, hy, 15, FUR)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (pose.puff > 0.05) {
    // Wide, furious eyes.
    ctx.arc(hx + 6, hy - 3, 4, 0, Math.PI * 2)
  } else {
    ctx.moveTo(hx + 1, hy - 3)
    ctx.lineTo(hx + 9, hy - 2)
  }
  ctx.moveTo(hx + 13, hy + 4)
  ctx.lineTo(hx + 20, hy + 2)
  ctx.moveTo(hx + 13, hy + 7)
  ctx.lineTo(hx + 21, hy + 8)
  ctx.stroke()
  ctx.fillStyle = palette.pink
  ctx.beginPath()
  ctx.arc(hx + 13, hy + 2, 2.5, 0, Math.PI * 2)
  ctx.fill()
  const lap = pose.lap ?? 0
  if (lap > 0) {
    // A pink tongue flicking at your water.
    ctx.strokeStyle = palette.pink
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(hx + 14, hy + 7)
    ctx.lineTo(hx + 16 + lap * 7, hy + 10 + lap * 9)
    ctx.stroke()
  }
  ctx.restore()
}

const DUCK: SketchStyle = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2.5,
  wobble: 1.2
}
const BEAK: SketchStyle = {
  fill: palette.orange,
  color: palette.ink,
  width: 2,
  wobble: 0.8
}
const beakPoints = new Float64Array(6)

/** A rubber duck sitting on (x, y), its waterline. */
export function drawDuck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  DUCK.seed = 320
  sketchEllipse(ctx, x, y - 9, 20, 12, DUCK)
  DUCK.seed = 321
  sketchCircle(ctx, x + 10, y - 26, 10, DUCK)
  beakPoints[0] = x + 18
  beakPoints[1] = y - 28
  beakPoints[2] = x + 30
  beakPoints[3] = y - 24
  beakPoints[4] = x + 18
  beakPoints[5] = y - 21
  sketchPolygon(ctx, beakPoints, BEAK)
  ctx.fillStyle = palette.ink
  ctx.beginPath()
  ctx.arc(x + 12, y - 29, 2.2, 0, Math.PI * 2)
  ctx.fill()
}

const DOG: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 5,
  color: palette.ink,
  width: 2.5,
  wobble: 1.5
}
const DOG_TAIL: SketchStyle = {
  color: palette.brown,
  width: 6,
  passes: 1,
  seed: 322
}
const DOG_EAR: SketchStyle = {
  fill: '#6b3f1d',
  color: palette.ink,
  width: 2,
  wobble: 1
}

/**
 * The scruffy brown dog standing on (x, y), facing right (1) or left (-1): floppy ears, a
 * lolling tongue and a wagging tail. `run` (0 to 1) swings its legs; `headOnly` draws just
 * the head peeking in.
 */
export function drawDog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 1 | -1,
  run: number,
  timeMs: number,
  headOnly = false
): void {
  ctx.save()
  ctx.translate(x, y)
  if (facing < 0) ctx.scale(-1, 1)
  const swing = Math.sin(timeMs / 60) * 10 * run
  if (!headOnly) {
    LEG.seed = 320
    sketchLine(ctx, -18, -20, -18 + swing, 0, LEG)
    LEG.seed = 321
    sketchLine(ctx, 16, -20, 16 - swing, 0, LEG)
    // The tail wags hard.
    const wag = Math.sin(timeMs / 70) * 0.6
    sketchLine(
      ctx,
      -28,
      -30,
      -28 - Math.cos(wag) * 20,
      -30 - Math.sin(wag + 0.8) * 20,
      DOG_TAIL
    )
    DOG.seed = 323
    sketchEllipse(ctx, 0, -30, 32, 15, DOG)
  }
  // Head, a floppy ear, a big nose and the tongue.
  const hx = headOnly ? 0 : 30
  const hy = headOnly ? -14 : -44
  DOG.seed = 324
  sketchCircle(ctx, hx, hy, 15, DOG)
  DOG_EAR.seed = 325
  sketchEllipse(ctx, hx - 8, hy + 2, 6, 12, DOG_EAR)
  ctx.fillStyle = palette.ink
  ctx.beginPath()
  ctx.arc(hx + 14, hy - 1, 4, 0, Math.PI * 2)
  ctx.arc(hx + 3, hy - 6, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = palette.pink
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(hx + 10, hy + 8)
  ctx.lineTo(hx + 12, hy + 16 + Math.sin(timeMs / 90) * 2)
  ctx.stroke()
  ctx.restore()
}
