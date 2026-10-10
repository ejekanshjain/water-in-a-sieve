import { BIG_SIEVE_ART } from '../../game/tuning'
import {
  boilSeed,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPolygon,
  sketchRoundRect,
  type SketchStyle
} from '../../shared'

/** The face the scenes put on the hero after a drain or a No-Drip Trip. */
export type HeroFace = 'plain' | 'despair' | 'smug'

/** Everything the hero drawing needs for one frame. */
export interface HeroPose {
  /** Body centre x and the ground line y. */
  x: number
  groundY: number
  /** Stride phase 0 to 1 and speed in m/s, for legs and bob. */
  stride: number
  speed: number
  /** 1 faces the house, -1 faces the well. */
  facing: 1 | -1
  /** Holds the sieve out in front. */
  carrying: boolean
  /** Water in the sieve, 0 to 1. */
  water: number
  /** Total steadiness level, for the face. */
  worry: number
  /** X eyes after a drain. */
  despair: boolean
  /** Arm tremble from fatigue, 0 to 1. */
  tremble: number
  /** Sieve tilt toward the front (+) or back (-), in radians, for the side view. */
  lean: number
  /** A slip in progress, 0 to 1: the hero tips over backwards around the feet. */
  fall: number
  timeMs: number
  /** Cutscene arms when not carrying: both up in triumph, or a phone at the ear. */
  arms?: 'down' | 'up' | 'phone'
  /** A smug little smile, after something went right. */
  smug?: boolean
  /** A frilly shower cap over the bedhead, for the ending's bath. */
  cap?: boolean
  /** Turned to the camera with a flat, dead stare. */
  stare?: boolean
}

const SKIN = '#f6d5b5'
const LEG: SketchStyle = {
  color: palette.blue,
  width: 11,
  passes: 1,
  wobble: 1.5
}
const LEG_STRIPE: SketchStyle = {
  color: '#ffffff',
  width: 2,
  passes: 1,
  wobble: 1
}
const FOOT: SketchStyle = {
  fill: SKIN,
  color: palette.ink,
  width: 2,
  wobble: 1
}
const SHIRT: SketchStyle = {
  fill: '#ffffff',
  color: palette.ink,
  width: 3,
  wobble: 1.5
}
const TIE: SketchStyle = {
  fill: palette.red,
  color: palette.ink,
  width: 2,
  wobble: 1
}
const TOWEL: SketchStyle = {
  fill: palette.pink,
  fillStyle: 'hatch',
  hatchGap: 5,
  color: palette.ink,
  width: 2,
  wobble: 1
}
const HEAD: SketchStyle = {
  fill: SKIN,
  color: palette.ink,
  width: 3,
  wobble: 1.5
}
const HAIR: SketchStyle = { color: palette.ink, width: 3, passes: 1, wobble: 2 }
const ARM: SketchStyle = { color: palette.ink, width: 9, passes: 1, wobble: 1 }
const SLEEVE: SketchStyle = { color: '#ffffff', width: 5, passes: 1, wobble: 0 }
const RIM: SketchStyle = { color: '#9a6a3a', width: 5, wobble: 1.5 }
const MESH: SketchStyle = {
  fill: 'rgba(120,120,120,0.35)',
  fillStyle: 'hatch',
  hatchGap: 5,
  color: palette.inkSoft,
  width: 1.5,
  wobble: 1
}
const tiePoints = new Float64Array(8)
const hatPoints = new Float64Array(6)
const SLIPPER: SketchStyle = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2,
  wobble: 1
}
const SOAKED = '#a9bccb'
const HAT: SketchStyle = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2.5,
  wobble: 1
}
const HAT_STRIPES: SketchStyle = {
  fill: palette.pink,
  fillStyle: 'hatch',
  hatchGap: 6,
  hatchAngle: 0.6,
  width: 0,
  wobble: 1
}
const POM_POM: SketchStyle = {
  fill: palette.pink,
  color: palette.ink,
  width: 2,
  wobble: 1,
  seed: 63
}
const SWATTER_HANDLE: SketchStyle = {
  color: palette.red,
  width: 4,
  passes: 1,
  wobble: 1
}
const SWATTER_MESH: SketchStyle = {
  fill: 'rgba(201, 42, 42, 0.35)',
  fillStyle: 'hatch',
  hatchGap: 4,
  color: palette.red,
  width: 2.5,
  wobble: 1
}

/**
 * What the hero wears in every scene: the party hat, slippers (dry or soaked) and the fly
 * swatter in the back pocket. The renderer sets it from the game state once per frame.
 */
export const outfit: {
  hat: boolean
  feet: 'bare' | 'slippers' | 'soaked'
  /** The swatter rides in the back pocket, except mid-swing. */
  swatter: boolean
  /** The sieve itself: Finer Mesh hatches tighter, the Bigger Sieve draws 1.4x and strains you. */
  fineMesh: boolean
  bigSieve: boolean
} = {
  hat: false,
  feet: 'bare',
  swatter: false,
  fineMesh: false,
  bigSieve: false
}

/**
 * The hero's line boil: every stroke's wobble changes 5 times a second, like a redrawn
 * cartoon. It stays 0 under Reduced Motion. Set at the start of each drawing.
 */
let boil = 0

/** Draws the hero in side view. Facing -1 mirrors the drawing. */
export function drawHero(ctx: CanvasRenderingContext2D, pose: HeroPose): void {
  boil = boilSeed(pose.timeMs, 5) * 50
  const { x, groundY: gy } = pose
  const moving = Math.min(1, pose.speed / 2.5)
  const swing = Math.sin(pose.stride * Math.PI * 2) * moving
  const bob = -Math.abs(Math.sin(pose.stride * Math.PI)) * 6 * moving
  // The Bigger Sieve is heavy: the arms sag and shake even when you're fresh.
  const strain = outfit.bigSieve && pose.carrying
  const tremble = strain ? Math.max(pose.tremble, 0.4) : pose.tremble
  const shake = tremble * Math.sin(pose.timeMs / 22) * 3
  ctx.save()
  ctx.translate(x, 0)
  if (pose.facing < 0) ctx.scale(-1, 1)
  if (pose.fall > 0) {
    ctx.translate(0, gy)
    ctx.rotate(-pose.fall * 1.25)
    ctx.translate(0, -gy)
  }

  // Legs: striped pyjama bottoms.
  const hipY = gy - 82 + bob
  const chestY = gy - 172 + bob
  if (outfit.swatter) drawPocketSwatter(ctx, hipY, chestY)
  const footA = swing * 24
  const footB = -swing * 24
  LEG.seed = 1 + boil
  sketchLine(ctx, -6, hipY, footA - 4, gy - 6, LEG)
  LEG.seed = 2 + boil
  sketchLine(ctx, 6, hipY, footB + 4, gy - 6, LEG)
  LEG_STRIPE.seed = 3 + boil
  sketchLine(ctx, -6, hipY + 20, footA - 4, gy - 22, LEG_STRIPE)
  if (outfit.feet === 'bare') {
    FOOT.seed = 4 + boil
    sketchEllipse(ctx, footA, gy - 4, 13, 6, FOOT)
    FOOT.seed = 5 + boil
    sketchEllipse(ctx, footB + 8, gy - 4, 13, 6, FOOT)
  } else {
    drawSlipper(ctx, footA, gy, 4, pose.timeMs)
    drawSlipper(ctx, footB + 8, gy, 5, pose.timeMs)
  }

  // Shirt, tie and the towel over one shoulder.
  SHIRT.seed = 6 + boil
  sketchRoundRect(ctx, -24, chestY, 48, 94, 10, SHIRT)
  tiePoints[0] = 2
  tiePoints[1] = chestY + 6
  tiePoints[2] = 10
  tiePoints[3] = chestY + 54
  tiePoints[4] = 2
  tiePoints[5] = chestY + 66
  tiePoints[6] = -6
  tiePoints[7] = chestY + 54
  TIE.seed = 7 + boil
  sketchPolygon(ctx, tiePoints, TIE)
  TOWEL.seed = 8 + boil
  sketchRoundRect(ctx, -26, chestY - 4, 16, 52, 5, TOWEL)

  // Head with bedhead and a face that reacts.
  const headX = 6
  const headY = chestY - 34
  drawHeroHead(ctx, headX, headY, pose)
  if (strain) drawStrainDrop(ctx, headX, headY, pose.timeMs)

  // Arms out front, holding the sieve level (or not).
  const shoulderY = chestY + 18
  const handX = 62
  const handY = chestY + 46 + shake + (strain ? 8 : 0)
  if (pose.carrying) {
    ARM.seed = 13 + boil
    sketchLine(ctx, 8, shoulderY, handX, handY, ARM)
    SLEEVE.seed = 14 + boil
    sketchLine(ctx, 8, shoulderY, handX - 18, handY - 7, SLEEVE)
    ctx.fillStyle = SKIN
    ctx.beginPath()
    ctx.arc(handX, handY, 6, 0, Math.PI * 2)
    ctx.fill()
    drawSideSieve(ctx, handX + 30, handY - 2, pose)
  } else if (pose.arms === 'up') {
    // Wide, so the hands clear the head.
    ARM.seed = 15 + boil
    sketchLine(ctx, 18, shoulderY, 62, shoulderY - 62, ARM)
    ARM.seed = 18 + boil
    sketchLine(ctx, -18, shoulderY, -54, shoulderY - 58, ARM)
  } else if (pose.arms === 'phone') {
    // Held to the ear, behind the eyes.
    ARM.seed = 15 + boil
    sketchLine(ctx, 8, shoulderY, 24, shoulderY - 10, ARM)
    sketchLine(ctx, 24, shoulderY - 10, 10, headY + 16, ARM)
    PHONE.seed = 19 + boil
    sketchRoundRect(ctx, 0, headY - 10, 12, 26, 3, PHONE)
  } else {
    ARM.seed = 15 + boil
    sketchLine(ctx, 4, shoulderY, 18 + swing * 10, shoulderY + 62, ARM)
  }
  ctx.restore()
}

/**
 * The hero's head alone, centred on (hx, hy): bedhead or the shower cap, the face, and
 * the party hat if you bought it. `drawHero` uses it, and so does the ending's close-up.
 */
export function drawHeroHead(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  pose: HeroPose
): void {
  boil = boilSeed(pose.timeMs, 5) * 50
  HEAD.seed = 9 + boil
  sketchCircle(ctx, hx, hy, 34, HEAD)
  if (pose.cap) {
    drawShowerCap(ctx, hx, hy)
  } else {
    for (let i = 0; i < 3; i++) {
      HAIR.seed = 10 + i + boil
      const x = hx - 12 + i * 12
      sketchLine(ctx, x, hy - 32, x + (i - 1) * 9, hy - 52 - (i % 2) * 6, HAIR)
    }
  }
  drawFace(ctx, hx, hy, pose)
  if (outfit.hat) drawPartyHat(ctx, hx, hy)
}

const CAP_PINK = '#ffc9de'
const CAP: SketchStyle = {
  fill: CAP_PINK,
  color: palette.ink,
  width: 2.5,
  wobble: 1.5,
  seed: 66
}

/** A puffy pink shower cap with a frilly elastic band, clear of the eyes. */
function drawShowerCap(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number
): void {
  sketchEllipse(ctx, hx - 2, hy - 30, 42, 22, CAP)
  ctx.strokeStyle = palette.ink
  ctx.fillStyle = CAP_PINK
  ctx.lineWidth = 2
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath()
    ctx.arc(hx - 2 + i * 11, hy - 14, 5.5, 0, Math.PI)
    ctx.fill()
    ctx.stroke()
  }
}

/** A bunny slipper on the ground at (x, groundY): yellow and perky, or soaked and droopy. */
function drawSlipper(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  seed: number,
  timeMs: number
): void {
  const soaked = outfit.feet === 'soaked'
  SLIPPER.fill = soaked ? SOAKED : palette.yellow
  SLIPPER.seed = seed + 40 + boil
  sketchEllipse(ctx, x + 2, gy - 6, 17, 8, SLIPPER)
  // Floppy ears: up when dry, flat when soaked.
  const droop = soaked ? 1 : 0
  for (let dx = 6; dx <= 13; dx += 7) {
    SLIPPER.seed = seed + 42 + dx + boil
    sketchEllipse(
      ctx,
      x + dx + droop * 6,
      gy - 16 + droop * 7,
      3.5,
      9 - droop * 4,
      SLIPPER
    )
  }
  ctx.fillStyle = palette.pink
  ctx.beginPath()
  ctx.arc(x + 17, gy - 8, 2.5, 0, Math.PI * 2)
  ctx.fill()
  if (!soaked) return
  // Squelch: a drip falling off the toe.
  const drop = (timeMs / 700 + seed * 0.37) % 1
  ctx.fillStyle = palette.water
  ctx.beginPath()
  ctx.arc(x + 18, gy - 2 + drop * 6, 2.5 * (1 - drop * 0.5), 0, Math.PI * 2)
  ctx.fill()
}

/** A striped party hat perched at a jaunty angle, with a pom-pom on top. */
function drawPartyHat(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number
): void {
  hatPoints[0] = hx - 14
  hatPoints[1] = hy - 28
  hatPoints[2] = hx + 18
  hatPoints[3] = hy - 26
  hatPoints[4] = hx + 14
  hatPoints[5] = hy - 82
  HAT.seed = 61 + boil
  sketchPolygon(ctx, hatPoints, HAT)
  HAT_STRIPES.seed = 62 + boil
  sketchPolygon(ctx, hatPoints, HAT_STRIPES)
  sketchCircle(ctx, hx + 14, hy - 84, 6, POM_POM)
  // The elastic, round the back of your head to your chin.
  ctx.strokeStyle = palette.inkSoft
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(hx - 12, hy - 27)
  ctx.quadraticCurveTo(hx - 30, hy + 10, hx + 2, hy + 33)
  ctx.stroke()
}

/** The swatter's handle down the back of your pyjamas, its mesh poking up behind you. */
function drawPocketSwatter(
  ctx: CanvasRenderingContext2D,
  hipY: number,
  chestY: number
): void {
  SWATTER_HANDLE.seed = 64 + boil
  sketchLine(ctx, -18, hipY + 6, -40, chestY - 6, SWATTER_HANDLE)
  ctx.save()
  ctx.translate(-44, chestY - 22)
  ctx.rotate(-0.45)
  SWATTER_MESH.seed = 65 + boil
  sketchRoundRect(ctx, -13, -18, 26, 30, 5, SWATTER_MESH)
  ctx.restore()
}

const PHONE: SketchStyle = {
  fill: palette.ink,
  color: palette.ink,
  width: 2,
  wobble: 0.5
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  pose: HeroPose
): void {
  ctx.strokeStyle = palette.ink
  ctx.fillStyle = palette.ink
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  if (pose.stare) {
    // Straight at the camera: two dots and a flat line. Nothing left to say.
    ctx.beginPath()
    ctx.arc(hx - 11, hy - 4, 3.5, 0, Math.PI * 2)
    ctx.arc(hx + 11, hy - 4, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(hx - 9, hy + 15)
    ctx.lineTo(hx + 9, hy + 15)
    ctx.stroke()
    return
  }
  const ex = hx + 14
  if (pose.despair) {
    for (let dx = 0; dx <= 14; dx += 14) {
      ctx.beginPath()
      ctx.moveTo(ex + dx - 4, hy - 10)
      ctx.lineTo(ex + dx + 4, hy - 2)
      ctx.moveTo(ex + dx + 4, hy - 10)
      ctx.lineTo(ex + dx - 4, hy - 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(ex + 8, hy + 18, 7, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    return
  }
  ctx.beginPath()
  ctx.arc(ex, hy - 6, 3.5, 0, Math.PI * 2)
  ctx.arc(ex + 14, hy - 6, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  if (pose.smug) {
    ctx.arc(ex + 7, hy + 8, 9, Math.PI * 0.15, Math.PI * 0.85)
  } else {
    ctx.moveTo(ex - 2, hy + 14)
    ctx.lineTo(ex + 14, hy + 13 - pose.worry * 3)
  }
  ctx.stroke()
  if (pose.worry > 0.3) {
    // Tongue out in concentration.
    ctx.fillStyle = palette.pink
    ctx.beginPath()
    ctx.ellipse(ex + 14, hy + 17, 4, 5, 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  if (pose.worry > 0.7) {
    ctx.fillStyle = palette.water
    const drop = (pose.timeMs / 600) % 1
    ctx.beginPath()
    ctx.arc(hx - 26, hy - 18 + drop * 20, 4, 0, Math.PI * 2)
    ctx.arc(hx + 36, hy - 26 + drop * 16, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** A bead of sweat sliding down your temple: the sieve is heavy. */
function drawStrainDrop(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  timeMs: number
): void {
  const t = (timeMs / 900) % 1
  ctx.fillStyle = palette.water
  ctx.beginPath()
  ctx.arc(hx - 20, hy - 20 + t * 26, 3.5, 0, Math.PI * 2)
  ctx.fill()
}

/** The sieve seen from the side: a flat dish with a water line. */
function drawSideSieve(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pose: HeroPose
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(pose.lean)
  if (outfit.bigSieve) {
    // Held by its near rim, so the bigger dish reaches further out.
    ctx.translate(16, 0)
    ctx.scale(BIG_SIEVE_ART, BIG_SIEVE_ART)
  }
  MESH.seed = 16 + boil
  MESH.hatchGap = outfit.fineMesh ? 3 : 5
  sketchEllipse(ctx, 0, 4, 40, 9, MESH)
  if (pose.water > 0.01) {
    ctx.fillStyle = 'rgba(116, 192, 252, 0.8)'
    ctx.beginPath()
    ctx.ellipse(0, 1, 36 * Math.sqrt(pose.water), 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  RIM.seed = 17 + boil
  sketchEllipse(ctx, 0, 0, 42, 8, RIM)
  ctx.restore()
}

/** Where the side-view sieve sits, for drips falling from it. Matches `drawHero`. */
export function sideSievePosition(
  x: number,
  groundY: number,
  facing: 1 | -1,
  out: { x: number; y: number }
): { x: number; y: number } {
  out.x = x + facing * 92
  out.y = groundY - 172 + 46
  return out
}
