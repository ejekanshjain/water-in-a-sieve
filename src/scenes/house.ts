import { CONTAINERS, shownContainer } from '../game/containers'
import type { GameState, Sim } from '../game/sim'
import {
  CAT_HIT_RADIUS,
  CAM_X,
  CAM_Y,
  FLOOR_PUDDLE_HALF_M,
  GROUND_Y,
  HOUSE_HERO_START,
  POUR_GAUGE_BOTTOM,
  POUR_GAUGE_TOP,
  POUR_GAUGE_X,
  POUR_MAX_LPS,
  PLUG_HIT_RADIUS,
  PLUG_HOLE_X,
  PLUG_HOLE_Y,
  POUR_SAFE_LPS,
  UNITS_PER_METRE
} from '../game/tuning'
import {
  boilSeed,
  CachedLayer,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type LayerRect,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import { drawCat, drawDuck, type CatPose } from './art/animals'
import {
  drawHero,
  sideSievePosition,
  type HeroFace,
  type HeroPose
} from './art/hero'
import type { GestureHandler, PointerLike } from './input'
import type { PathScene } from './path'
import {
  drawRubArea,
  FLOOR_PUDDLE_X,
  rubBox,
  rubProgress,
  type RubBox
} from './wipe'

/** Each container lives in its own room: the back step, the kitchen and the bathroom. */
export type RoomId = 'step' | 'kitchen' | 'bathroom'
export const ROOM_FOR: readonly RoomId[] = ['step', 'kitchen', 'bathroom']

/** Where a room's container sits: its rim and base, half widths, and where pours land. */
interface Tank {
  x: number
  top: number
  bottom: number
  halfTop: number
  halfBottom: number
  pourX: number
}

const TANKS: Record<RoomId, Tank> = {
  step: {
    x: 384,
    top: 688,
    bottom: 752,
    halfTop: 44,
    halfBottom: 34,
    pourX: 384
  },
  kitchen: {
    x: 400,
    top: 690,
    bottom: 742,
    halfTop: 50,
    halfBottom: 40,
    pourX: 400
  },
  bathroom: {
    x: 420,
    top: 672,
    bottom: 756,
    halfTop: 116,
    halfBottom: 100,
    pourX: 432
  }
}

/** Water surface y in a tank `fill` (0 to 1) full. */
function tankWaterY(tank: Tank, fill: number): number {
  const f = Math.max(0, Math.min(1, fill))
  return tank.bottom - 6 - f * (tank.bottom - tank.top - 12)
}

/** The water surface in a room's container `fill` (0 to 1) full, for cutscenes. */
export function roomWaterY(room: RoomId, fill: number): number {
  return tankWaterY(TANKS[room], fill)
}

/** The rim of a room's container, in logical y. */
export function roomRimY(room: RoomId): number {
  return TANKS[room].top
}

/** Where the cat stands to drink from each room's container, and how far it leans in. */
export interface CatSpot {
  x: number
  y: number
  facing: 1 | -1
  tilt: number
}

const CAT_SPOTS: Record<RoomId, CatSpot> = {
  step: { x: 428, y: 688, facing: -1, tilt: -0.7 },
  kitchen: { x: 450, y: 690, facing: -1, tilt: -0.6 },
  bathroom: { x: 424, y: 672, facing: -1, tilt: -0.55 }
}

/** Where the cat drinks in a room. */
export function catSpot(room: RoomId): CatSpot {
  return CAT_SPOTS[room]
}

/** The chain's fixed end, on the tub's overflow plate. */
const CHAIN_X = 512
const CHAIN_Y = 678

/** Where the duck sits on the tub's rim. */
export const DUCK_RIM_X = 530

/** Duck placement in the bathroom: on the rim, floating, or left to a cutscene. */
export type DuckSpot = 'rim' | 'water' | 'none'

/** Where the cat's treat bowl sits on the floor. */
const TREAT_BOWL_X = 56
const TREAT_BOWL: SketchStyle = {
  fill: palette.blue,
  color: palette.ink,
  width: 2.5,
  wobble: 1,
  seed: 820
}

/** A shooed cat takes this long to puff up and leap away. */
const LEAVE_MS = 900

/** Where the outside wall of the house starts. */
const WALL_TOP = 330
const OUTSIDE_WALL = '#fff3dc'
const OUTSIDE_LINE = 'rgba(141, 85, 36, 0.18)'
const KITCHEN_WALL = '#fff3dc'
const KITCHEN_FLOOR = '#e2c9a0'
const BATH_WALL = '#dff0f7'
const BATH_FLOOR = '#e9dfcf'

const DOOR: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  seed: 101
}
const WINDOW: SketchStyle = {
  fill: '#d6ecfb',
  color: palette.ink,
  width: 3,
  seed: 102
}
const STEP: SketchStyle = {
  fill: '#c9c2b6',
  color: palette.ink,
  width: 2.5,
  seed: 103
}
const NOTE: SketchStyle = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2,
  seed: 104
}
const BUCKET: SketchStyle = {
  fill: '#9aa5ad',
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  wobble: 1.5,
  seed: 110
}
const WHITE: SketchStyle = { fill: '#ffffff', color: palette.ink, width: 3 }
const COUNTER: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 7,
  color: palette.ink,
  width: 3,
  seed: 130
}
const WORKTOP: SketchStyle = {
  fill: '#d9c3a0',
  color: palette.ink,
  width: 3,
  seed: 131
}
const TAP: SketchStyle = { color: '#8a9399', width: 7, passes: 1, wobble: 1 }
const DOORWAY: SketchStyle = {
  fill: '#e3f1fb',
  color: '#6b4a32',
  width: 6,
  seed: 140
}
const OPEN_DOOR: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  seed: 148
}
const openDoorPoints = new Float64Array([14, 560, -14, 548, -14, 782, 14, 770])
const PUDDLE: SketchStyle = {
  fill: 'rgba(116, 192, 252, 0.6)',
  color: palette.blue,
  width: 2,
  wobble: 2,
  seed: 111
}
const SIGN: SketchStyle = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2.5,
  wobble: 1,
  seed: 112
}
const signPoints = new Float64Array(6)

/**
 * The puddle on the walk-in, drawn bold with a wet-floor sign beside it, since walking
 * through it with water in your hands slips you. Rubbing shrinks it.
 */
function drawFloorPuddle(
  ctx: CanvasRenderingContext2D,
  rubbed: number,
  timeMs: number
): void {
  const left = 1 - 0.7 * rubbed
  const rx = FLOOR_PUDDLE_HALF_M * UNITS_PER_METRE * left
  sketchEllipse(ctx, FLOOR_PUDDLE_X, GROUND_Y + 8, rx, 10 * left, PUDDLE)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = 2
  const glint = Math.sin(timeMs / 500) * rx * 0.4
  ctx.beginPath()
  ctx.moveTo(FLOOR_PUDDLE_X + glint - 8, GROUND_Y + 5)
  ctx.lineTo(FLOOR_PUDDLE_X + glint + 8, GROUND_Y + 5)
  ctx.stroke()
  // The little yellow A-frame sign.
  const x = FLOOR_PUDDLE_X - 64
  signPoints[0] = x - 16
  signPoints[1] = GROUND_Y + 4
  signPoints[2] = x
  signPoints[3] = GROUND_Y - 52
  signPoints[4] = x + 16
  signPoints[5] = GROUND_Y + 4
  sketchPolygon(ctx, signPoints, SIGN)
  sketchText(ctx, '!', x, GROUND_Y - 18, BANG_TEXT)
}

// Styles drawn every frame in the house, hoisted so drawing allocates nothing.
const BANG_TEXT: SketchTextStyle = { font: 'marker', size: 22 }
const POUR_TEXT: SketchTextStyle = { font: 'marker', size: 20 }
/** The cat's crunching boils, so its seed is set per frame. */
const CRUNCH_TEXT: SketchTextStyle = {
  size: 18,
  tilt: 0.2,
  color: palette.inkSoft
}
const UMBRELLA: SketchStyle & { closed: boolean } = {
  closed: true,
  fill: palette.red,
  color: palette.ink,
  width: 3,
  seed: 190
}
const UMBRELLA_STICK: SketchStyle = { width: 3, seed: 191 }
const RAINBOW = [palette.red, palette.yellow, palette.green, palette.blue]
const PLUG_DASH = [7, 6]
const NO_DASH: number[] = []

const GAUGE: SketchStyle = {
  color: palette.ink,
  width: 3,
  wobble: 1.5,
  seed: 112
}
const tankPoints = new Float64Array(8)

/** An open doorway on the left, the way you came in from the garden. */
function paintDoorway(ctx: CanvasRenderingContext2D): void {
  sketchRect(ctx, 14, 560, 84, 210, DOORWAY)
  // The garden outside: grass and a far-off hill.
  ctx.fillStyle = '#cfe8b0'
  ctx.fillRect(20, 712, 72, 56)
  sketchLine(ctx, 20, 712, 92, 706, {
    color: palette.green,
    width: 3,
    seed: 141
  })
  sketchPolygon(ctx, openDoorPoints, OPEN_DOOR)
}

/** The interview reminder that follows you round the house. */
function paintNote(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  sketchRect(ctx, x - 40, y - 32, 80, 64, NOTE)
  sketchText(ctx, 'INTERVIEW', x, y - 10, { size: 15, rotate: -0.06 })
  sketchText(ctx, '9AM', x, y + 12, { size: 20, rotate: -0.06, font: 'marker' })
}

/** The back step: door, window, step and the sticky note on the outside wall. */
function paintStep(ctx: CanvasRenderingContext2D): void {
  sketchRect(ctx, 110, 430, 120, 96, WINDOW)
  sketchLine(ctx, 170, 430, 170, 526, { width: 2, seed: 105 })
  sketchLine(ctx, 110, 478, 230, 478, { width: 2, seed: 106 })
  sketchRect(ctx, 440, 590, 86, 180, DOOR)
  sketchCircle(ctx, 452, 684, 5, {
    fill: palette.yellow,
    width: 1.5,
    seed: 107
  })
  sketchRect(ctx, 290, 752, 260, 20, STEP)
  paintNote(ctx, 290, 472)
  tankBody(ctx, TANKS.step)
}

/** The kitchen: a window onto the garden, a clock at 8:59, the counter, sink and dishes. */
function paintKitchen(ctx: CanvasRenderingContext2D): void {
  paintDoorway(ctx)
  sketchRect(ctx, 120, 470, 120, 90, WINDOW)
  ctx.fillStyle = '#cfe8b0'
  ctx.fillRect(124, 530, 112, 26)
  sketchRect(ctx, 196, 518, 22, 18, { fill: '#b8b0a6', width: 2, seed: 142 })
  sketchLine(ctx, 180, 470, 180, 560, { width: 2, seed: 143 })
  // The clock says you're late.
  sketchCircle(ctx, 300, 520, 26, { ...WHITE, seed: 144 })
  sketchLine(ctx, 300, 520, 300, 500, { width: 3, seed: 145 })
  sketchLine(ctx, 300, 520, 296, 532, { width: 3, seed: 146 })
  // Tiles behind the counter.
  ctx.strokeStyle = 'rgba(80, 140, 170, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let x = 300; x <= 560; x += 26) {
    ctx.moveTo(x, 610)
    ctx.lineTo(x, 678)
  }
  for (let y = 610; y < 678; y += 22) {
    ctx.moveTo(300, y)
    ctx.lineTo(560, y)
  }
  ctx.stroke()
  // The tap curls over the sink, bone dry.
  TAP.seed = 147
  sketchLine(ctx, 474, 680, 474, 622, TAP)
  sketchLine(ctx, 474, 622, 438, 622, TAP)
  sketchLine(ctx, 438, 622, 438, 638, TAP)
  sketchRect(ctx, 306, 690, 260, 80, COUNTER)
  sketchRect(ctx, 296, 678, 56, 12, WORKTOP)
  sketchRect(ctx, 448, 678, 120, 12, { ...WORKTOP, seed: 132 })
  const tank = TANKS.kitchen
  tankShape(tank)
  sketchPolygon(ctx, tankPoints, { fill: '#5c6870', width: 0, seed: 133 })
  // A tower of dirty dishes, waiting.
  for (let i = 0; i < 6; i++) {
    sketchEllipse(ctx, 506 + (i % 2) * 3, 670 - i * 7, 30, 6, {
      ...WHITE,
      width: 2,
      seed: 150 + i
    })
  }
  sketchRoundRect(ctx, 488, 612, 26, 18, 4, {
    fill: palette.red,
    width: 2,
    seed: 157
  })
  ctx.fillStyle = 'rgba(141, 85, 36, 0.5)'
  ctx.beginPath()
  ctx.arc(506, 636, 5, 0, Math.PI * 2)
  ctx.arc(520, 646, 4, 0, Math.PI * 2)
  ctx.fill()
}

/** The bathroom: the mirror and note, a towel, the skylight and the claw-foot tub. */
function paintBathroom(ctx: CanvasRenderingContext2D): void {
  paintDoorway(ctx)
  sketchRoundRect(ctx, 120, 470, 100, 92, 12, {
    fill: '#e8f4fb',
    color: palette.ink,
    width: 4,
    seed: 160
  })
  sketchLine(ctx, 140, 548, 170, 486, { color: '#ffffff', width: 5, seed: 161 })
  paintNote(ctx, 214, 486)
  sketchLine(ctx, 232, 590, 290, 590, { width: 4, seed: 162 })
  sketchRect(ctx, 244, 590, 36, 70, {
    fill: palette.pink,
    fillStyle: 'hatch',
    hatchGap: 6,
    width: 2.5,
    seed: 163
  })
  // Light falls from the skylight onto the tub.
  ctx.fillStyle = 'rgba(255, 236, 153, 0.35)'
  ctx.beginPath()
  ctx.moveTo(436, 330)
  ctx.lineTo(530, 330)
  ctx.lineTo(560, 672)
  ctx.lineTo(330, 672)
  ctx.closePath()
  ctx.fill()
  sketchRect(ctx, 432, 322, 102, 22, { ...WINDOW, seed: 164 })
  tankBody(ctx, TANKS.bathroom)
  // Claw feet.
  for (const fx of [336, 504]) {
    sketchEllipse(ctx, fx, 762, 13, 8, {
      fill: palette.yellow,
      width: 2,
      seed: 165 + fx
    })
  }
}

/** Tank outline points for the trapezoid between rim and base. */
function tankShape(tank: Tank): void {
  tankPoints[0] = tank.x - tank.halfTop
  tankPoints[1] = tank.top
  tankPoints[2] = tank.x + tank.halfTop
  tankPoints[3] = tank.top
  tankPoints[4] = tank.x + tank.halfBottom
  tankPoints[5] = tank.bottom
  tankPoints[6] = tank.x - tank.halfBottom
  tankPoints[7] = tank.bottom
}

/** The container's body behind its water: the bucket's hatch or the tub's white enamel. */
function tankBody(ctx: CanvasRenderingContext2D, tank: Tank): void {
  tankShape(tank)
  sketchPolygon(
    ctx,
    tankPoints,
    tank === TANKS.step ? BUCKET : { ...WHITE, seed: 166 }
  )
}

/** Lines drawn over the water: rims, the basin edges, the tub's ruler and plug chain. */
function paintTankFront(ctx: CanvasRenderingContext2D, room: RoomId): void {
  const tank = TANKS[room]
  if (room === 'step') {
    sketchEllipse(ctx, tank.x, tank.top, tank.halfTop, 9, {
      color: palette.ink,
      width: 3,
      seed: 113
    })
    return
  }
  tankShape(tank)
  if (room === 'kitchen') {
    sketchPath(ctx, tankPoints, { width: 3, seed: 134, closed: true })
    return
  }
  sketchPath(ctx, tankPoints, { width: 3.5, seed: 167, closed: true })
  sketchLine(
    ctx,
    tank.x - tank.halfTop - 8,
    tank.top,
    tank.x + tank.halfTop + 8,
    tank.top,
    {
      width: 7,
      color: palette.ink,
      seed: 168
    }
  )
  // The litre ruler painted on the side.
  sketchLine(ctx, 334, tankWaterY(tank, 0), 334, tankWaterY(tank, 1), {
    color: palette.red,
    width: 2,
    seed: 169
  })
  for (let i = 1; i <= 4; i++) {
    const y = tankWaterY(tank, i / 4)
    sketchLine(ctx, 326, y, 342, y, {
      color: palette.red,
      width: 3,
      seed: 170 + i
    })
    sketchText(ctx, i === 4 ? '100 L' : `${i * 25}`, 347, y, {
      size: 14,
      align: 'left',
      color: palette.red
    })
  }
}

/** Where the plug is: in its hole, or pulled out to (x, y). */
export interface PlugView {
  out: boolean
  x: number
  y: number
}

const PLUG_IN: PlugView = { out: false, x: PLUG_HOLE_X, y: PLUG_HOLE_Y }

/** The plug chain from the overflow plate to the plug, sagging between them. */
function drawPlugChain(ctx: CanvasRenderingContext2D, plug: PlugView): void {
  const midX = (CHAIN_X + plug.x) / 2 + 6
  const midY = Math.max(CHAIN_Y, plug.y) + 18
  ctx.fillStyle = '#8a9399'
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const a = (1 - t) * (1 - t)
    const b = 2 * (1 - t) * t
    const c = t * t
    ctx.beginPath()
    ctx.arc(
      a * CHAIN_X + b * midX + c * plug.x,
      a * CHAIN_Y + b * midY + c * plug.y,
      2.5,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }
  // The rubber plug itself.
  ctx.fillStyle = '#2b2b2b'
  ctx.beginPath()
  ctx.ellipse(plug.x, plug.y, 11, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2
  ctx.stroke()
}

/** The skylight's frame and where rain lands, in logical units. */
const SKY_LEFT = 432
const SKY_RIGHT = 534
const SKY_Y = 344
const UMBRELLA_X = 440
const UMBRELLA_Y = 560

/**
 * Spring rain through the skylight: grey clouds, streaks falling into the tub, and the
 * gag for this rain (an umbrella over the tub, or a rainbow once it stops).
 */
function drawRain(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  waterY: number,
  timeMs: number
): void {
  const rain = state.rain
  const falling = rain.stage === 'falling'
  if (falling) {
    ctx.fillStyle = '#8d99a6'
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(SKY_LEFT + 14 + i * 26, SKY_Y - 10, 16, 0, Math.PI * 2)
      ctx.fill()
    }
    const stop = rain.gag === 'umbrella' ? UMBRELLA_Y - 40 : waterY
    ctx.strokeStyle = 'rgba(77, 171, 247, 0.8)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < 16; i++) {
      const x = SKY_LEFT + ((i * 37) % (SKY_RIGHT - SKY_LEFT)) - i * 3
      const y = SKY_Y + (((timeMs * 0.9 + i * 53) % 260) / 260) * (stop - SKY_Y)
      ctx.moveTo(x - (y - SKY_Y) * 0.15, y)
      ctx.lineTo(x - (y - SKY_Y) * 0.15 - 3, y + 16)
    }
    ctx.stroke()
  }
  if (rain.gag === 'umbrella') {
    // A red umbrella keeps the tub bone dry.
    sketchPath(ctx, umbrellaPoints, UMBRELLA)
    sketchLine(
      ctx,
      UMBRELLA_X,
      UMBRELLA_Y - 36,
      UMBRELLA_X,
      UMBRELLA_Y + 40,
      UMBRELLA_STICK
    )
  }
  if (rain.gag === 'rainbow' && rain.stage === 'draining') {
    ctx.lineWidth = 7
    for (let i = 0; i < RAINBOW.length; i++) {
      ctx.strokeStyle = RAINBOW[i] ?? palette.red
      ctx.beginPath()
      ctx.arc(430, 690, 130 - i * 8, Math.PI, Math.PI * 2)
      ctx.stroke()
    }
  }
}

const umbrellaPoints = new Float64Array([
  UMBRELLA_X - 70,
  UMBRELLA_Y - 30,
  UMBRELLA_X - 40,
  UMBRELLA_Y - 62,
  UMBRELLA_X,
  UMBRELLA_Y - 74,
  UMBRELLA_X + 40,
  UMBRELLA_Y - 62,
  UMBRELLA_X + 70,
  UMBRELLA_Y - 30
])

/** On a visit: a pulsing ring round the pulled plug and a dashed target over its hole. */
function drawPlugTarget(
  ctx: CanvasRenderingContext2D,
  plug: PlugView,
  timeMs: number
): void {
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(timeMs / 220))
  ctx.strokeStyle = palette.red
  ctx.lineWidth = 3
  ctx.globalAlpha = pulse
  ctx.setLineDash(PLUG_DASH)
  ctx.beginPath()
  ctx.arc(PLUG_HOLE_X, PLUG_HOLE_Y, 20, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash(NO_DASH)
  ctx.beginPath()
  ctx.arc(plug.x, plug.y, 18 + pulse * 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** The open plughole with the water swirling down it. */
function drawPlughole(
  ctx: CanvasRenderingContext2D,
  waterY: number,
  timeMs: number
): void {
  ctx.fillStyle = '#1b1b1b'
  ctx.beginPath()
  ctx.ellipse(PLUG_HOLE_X, PLUG_HOLE_Y + 4, 13, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  if (waterY > PLUG_HOLE_Y - 8) return
  // A whirlpool in the water above it.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 2
  const spin = timeMs / 120
  for (let i = 0; i < 3; i++) {
    const r = 8 + i * 9
    const y = Math.max(waterY + 8, PLUG_HOLE_Y - 14 - i * 16)
    ctx.beginPath()
    ctx.ellipse(PLUG_HOLE_X, y, r, r * 0.3, 0, spin + i, spin + i + 3.6)
    ctx.stroke()
  }
}

/**
 * The house at the end of the path: the room for the current container, the walk-in and
 * the pour with its stream. Also draws the pour gauge, which doesn't shake, and the rooms
 * that cutscenes reuse.
 */
export class HouseScene {
  private readonly backs: Record<RoomId, CachedLayer>
  private readonly fronts: Record<RoomId, CachedLayer>
  private readonly side = { x: 0, y: 0 }
  /** The room the cam floor shows, from the latest `drawWorld`. */
  private camRoom: RoomId = 'step'
  private readonly box: RubBox = { x: 0, y: 0, width: 0, height: 0 }
  private readonly plug: PlugView = { out: false, x: 0, y: 0 }
  private readonly cat: CatPose = {
    facing: -1,
    stride: 0,
    puff: 0,
    paw: 0,
    lap: 0,
    timeMs: 0
  }
  /** A shooed cat leaping off: when it started (render time) and from which room. */
  private leaveAt = -1e9
  private leaveRoom: RoomId = 'step'
  private readonly pose: HeroPose = {
    x: HOUSE_HERO_START,
    groundY: GROUND_Y,
    stride: 0,
    speed: 0,
    facing: 1,
    carrying: true,
    water: 1,
    worry: 0,
    despair: false,
    tremble: 0,
    lean: 0,
    fall: 0,
    timeMs: 0
  }

  constructor(
    private readonly viewport: Viewport,
    private readonly path: PathScene
  ) {
    const back = (
      paint: (ctx: CanvasRenderingContext2D) => void,
      rect: LayerRect
    ) => new CachedLayer(viewport, paint, rect)
    const room: LayerRect = { x: 0, y: 316, width: 570, height: 470 }
    this.backs = {
      step: back(paintStep, { x: 90, y: 420, width: 470, height: 360 }),
      kitchen: back(paintKitchen, room),
      bathroom: back(paintBathroom, room)
    }
    const front: LayerRect = { x: 280, y: 640, width: 280, height: 130 }
    this.fronts = {
      step: back(ctx => paintTankFront(ctx, 'step'), front),
      kitchen: back(ctx => paintTankFront(ctx, 'kitchen'), front),
      bathroom: back(ctx => paintTankFront(ctx, 'bathroom'), front)
    }
  }

  /** Cached art, for warming up and repainting. */
  get layers(): CachedLayer[] {
    return [...Object.values(this.backs), ...Object.values(this.fronts)]
  }

  invalidate(): void {
    for (const layer of this.layers) layer.invalidate()
  }

  dispose(): void {
    for (const layer of this.layers) layer.dispose()
  }

  /** A shooed cat puffs up and leaps off the container, starting now. */
  shoo(room: RoomId, timeMs: number): void {
    this.leaveAt = timeMs
    this.leaveRoom = room
  }

  /** The cat lapping at your water, or leaping off after a shoo. */
  private drawCat(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    room: RoomId,
    timeMs: number
  ): void {
    const cat = this.cat
    cat.timeMs = timeMs
    const leaving = timeMs - this.leaveAt
    if (state.cat.mood === 'drinking') {
      const spot = CAT_SPOTS[room]
      cat.facing = spot.facing
      cat.puff = 0
      cat.stride = 0
      cat.lap = Math.max(0, Math.sin(timeMs / 110))
      ctx.save()
      ctx.translate(spot.x, spot.y)
      ctx.rotate(spot.tilt + Math.sin(timeMs / 110) * 0.04)
      drawCat(ctx, 0, 0, cat)
      ctx.restore()
      return
    }
    if (leaving < 0 || leaving > LEAVE_MS) {
      if (state.kit.treatTrips > 0) this.drawTreatCat(ctx, timeMs)
      return
    }
    // Puffed up in outrage for a moment, then a leap off to the right.
    const spot = CAT_SPOTS[this.leaveRoom]
    const t = Math.max(0, (leaving - 250) / (LEAVE_MS - 250))
    cat.lap = 0
    cat.puff = leaving < 250 ? 1 : Math.max(0, 1 - t * 2)
    cat.facing = 1
    cat.stride = (leaving / 120) % 1
    const x = spot.x + t * 320
    const y = spot.y - Math.sin(t * Math.PI) * 120 + t * (GROUND_Y - spot.y)
    drawCat(ctx, x, y, cat)
  }

  /** Cat Treats: the cat crunches away at its bowl by the door, ignoring your water. */
  private drawTreatCat(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const cat = this.cat
    sketchEllipse(ctx, TREAT_BOWL_X, GROUND_Y - 6, 24, 9, TREAT_BOWL)
    ctx.fillStyle = palette.brown
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(TREAT_BOWL_X - 12 + i * 8, GROUND_Y - 14, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    cat.facing = -1
    cat.puff = 0
    cat.stride = 0
    cat.paw = 0
    cat.lap = Math.max(0, Math.sin(timeMs / 140))
    ctx.save()
    ctx.translate(TREAT_BOWL_X + 46, GROUND_Y)
    ctx.rotate(-0.3 + Math.sin(timeMs / 140) * 0.03)
    drawCat(ctx, 0, 0, cat)
    ctx.restore()
    if (Math.sin(timeMs / 280) > 0.3) {
      CRUNCH_TEXT.seed = boilSeed(timeMs, 2)
      sketchText(ctx, 'crunch', TREAT_BOWL_X + 10, GROUND_Y - 70, CRUNCH_TEXT)
    }
  }

  /** Hero x for the walk-in. */
  heroX(state: GameState): number {
    return HOUSE_HERO_START + state.walker.distance * UNITS_PER_METRE
  }

  /**
   * Draws a room with its container `fill` (0 to 1) full: the background, details, water
   * and the container's front. Cutscenes call it too.
   */
  drawRoom(
    ctx: CanvasRenderingContext2D,
    room: RoomId,
    fill: number,
    timeMs: number,
    duck: DuckSpot = 'none',
    plug: PlugView = PLUG_IN,
    rainFill = 0
  ): void {
    this.drawWalls(ctx, room)
    this.backs[room].draw(ctx)
    const tank = TANKS[room]
    const y = tankWaterY(tank, fill + rainFill)
    if (room === 'bathroom' && plug.out) drawPlughole(ctx, y, timeMs)
    if (fill + rainFill > 0.004) this.drawWater(ctx, room, tank, y, timeMs)
    if (rainFill > 0.001) {
      // The rain's share sits on top as a pale band, so you watch it leave.
      ctx.fillStyle = 'rgba(253, 246, 227, 0.45)'
      const base = tankWaterY(tank, fill)
      ctx.fillRect(
        tank.x - tank.halfTop + 6,
        y + 2,
        tank.halfTop * 2 - 12,
        base - y
      )
    }
    this.fronts[room].draw(ctx)
    if (room !== 'bathroom') return
    drawPlugChain(ctx, plug)
    if (duck === 'rim') drawDuck(ctx, DUCK_RIM_X, tank.top - 4)
    else if (duck === 'water')
      drawDuck(ctx, 470, y + 6 + Math.sin(timeMs / 400) * 2)
  }

  drawWorld(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number,
    face: HeroFace
  ): void {
    const room = ROOM_FOR[shownContainer(state)] ?? 'step'
    this.camRoom = room
    const duck: DuckSpot = state.milestonesShown >= 1 ? 'water' : 'rim'
    const plug = this.plug
    plug.out = state.cat.plugOut
    plug.x = plug.out ? state.cat.plugX : PLUG_HOLE_X
    plug.y = plug.out ? state.cat.plugY : PLUG_HOLE_Y
    const rain = state.rain.stage !== 'dry' && room === 'bathroom'
    const rainFill = rain ? (state.containers[2]?.rainMl ?? 0) / 100_000 : 0
    this.drawRoom(ctx, room, this.fill(state), timeMs, duck, plug, rainFill)
    if (rain) drawRain(ctx, state, this.waterY(state) - rainFill * 72, timeMs)
    if (plug.out && state.phase === 'visit') drawPlugTarget(ctx, plug, timeMs)
    this.drawCat(ctx, state, room, timeMs)
    if (state.house.floorPatch) drawFloorPuddle(ctx, rubProgress(state), timeMs)
    const box = rubBox(state, this.box)
    if (box && state.wipe?.target === 'floor')
      drawRubArea(ctx, state, box, timeMs)

    const pose = this.pose
    const capacity = state.capacityMl || 1
    pose.x = this.heroX(state)
    pose.stride = state.walker.stride / 0.8
    pose.speed = state.walker.speed
    pose.water = state.sieve.inSieve / capacity
    pose.worry = state.steady.total
    pose.despair = face === 'despair'
    pose.smug = face === 'smug'
    pose.tremble = Math.min(1, Math.max(0, state.drift.fatigue - 1))
    pose.lean =
      state.phase === 'pour' || state.phase === 'poured'
        ? state.house.pourValue * 0.9
        : Math.max(-0.5, Math.min(0.5, state.grip.offsetX * 0.006))
    pose.carrying = state.phase !== 'visit'
    pose.timeMs = timeMs
    drawHero(ctx, pose)
    if (state.phase === 'pour' && state.house.flow > 0)
      this.drawStream(ctx, state, timeMs)
  }

  /** Where water leaves the tilted sieve's front rim. */
  lipPosition(state: GameState): { x: number; y: number } {
    const pos = sideSievePosition(this.heroX(state), GROUND_Y, 1, this.side)
    const lean = state.house.pourValue * 0.9
    pos.x += Math.cos(lean) * 42
    pos.y += Math.sin(lean) * 42
    return pos
  }

  /** The water surface in the current container, in logical y. */
  waterY(state: GameState): number {
    return tankWaterY(this.tank(state), this.fill(state))
  }

  /** Where the pour lands in the current container. */
  pourX(state: GameState): number {
    return this.tank(state).pourX
  }

  private tank(state: GameState): Tank {
    return TANKS[ROOM_FOR[shownContainer(state)] ?? 'step']
  }

  private fill(state: GameState): number {
    const index = shownContainer(state)
    const def = CONTAINERS[index]
    const ledger = state.containers[index]
    return def && ledger ? ledger.inContainer / def.capacityMl : 0
  }

  private drawWalls(ctx: CanvasRenderingContext2D, room: RoomId): void {
    const view = this.viewport.view
    const bottom = view.y + view.height
    if (room === 'step') {
      this.path.drawBackdrop(ctx, 0, HOUSE_HERO_START)
      ctx.fillStyle = OUTSIDE_WALL
      ctx.fillRect(view.x, WALL_TOP, view.width, GROUND_Y - WALL_TOP)
      ctx.strokeStyle = OUTSIDE_LINE
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let y = WALL_TOP + 30; y < GROUND_Y; y += 30) {
        ctx.moveTo(view.x, y)
        ctx.lineTo(view.x + view.width, y)
      }
      ctx.stroke()
      return
    }
    const bath = room === 'bathroom'
    ctx.fillStyle = bath ? BATH_WALL : KITCHEN_WALL
    ctx.fillRect(view.x, view.y, view.width, GROUND_Y - view.y)
    ctx.fillStyle = bath ? BATH_FLOOR : KITCHEN_FLOOR
    ctx.fillRect(view.x, GROUND_Y, view.width, bottom - GROUND_Y)
    ctx.strokeStyle = bath
      ? 'rgba(80, 140, 170, 0.25)'
      : 'rgba(120, 80, 40, 0.25)'
    ctx.lineWidth = 2
    ctx.beginPath()
    const step = bath ? 60 : 90
    const left = Math.floor(view.x / step) * step
    for (let x = left; x < view.x + view.width; x += step) {
      if (bath) {
        ctx.moveTo(x, view.y)
        ctx.lineTo(x, GROUND_Y)
      }
      ctx.moveTo(x, GROUND_Y)
      ctx.lineTo(x - 30, bottom)
    }
    if (bath)
      for (let y = GROUND_Y - 60; y > view.y; y -= 60) {
        ctx.moveTo(view.x, y)
        ctx.lineTo(view.x + view.width, y)
      }
    ctx.stroke()
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(view.x, GROUND_Y)
    ctx.lineTo(view.x + view.width, GROUND_Y)
    ctx.stroke()
  }

  private drawWater(
    ctx: CanvasRenderingContext2D,
    room: RoomId,
    tank: Tank,
    y: number,
    timeMs: number
  ): void {
    ctx.fillStyle = 'rgba(116, 192, 252, 0.85)'
    if (room === 'step') {
      ctx.beginPath()
      ctx.ellipse(tank.x, y, tank.halfTop - 6, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    // A cutaway: the water fills the basin or tub up to its line.
    const k = (y - tank.top) / (tank.bottom - tank.top)
    const half = tank.halfTop + (tank.halfBottom - tank.halfTop) * k - 4
    const wave = Math.sin(timeMs / 300) * 1.5
    ctx.beginPath()
    ctx.moveTo(tank.x - half, y + wave)
    ctx.lineTo(tank.x + half, y - wave)
    ctx.lineTo(tank.x + tank.halfBottom - 4, tank.bottom - 3)
    ctx.lineTo(tank.x - tank.halfBottom + 4, tank.bottom - 3)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(tank.x - half * 0.6, y + 4)
    ctx.lineTo(tank.x - half * 0.2, y + 4)
    ctx.stroke()
  }

  private drawStream(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    const lip = this.lipPosition(state)
    const flow = state.house.flow
    const endY = this.waterY(state)
    const wobble = Math.sin(timeMs / 40) * 2
    ctx.strokeStyle = 'rgba(116, 192, 252, 0.9)'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2 + flow * 7
    ctx.beginPath()
    ctx.moveTo(lip.x, lip.y)
    ctx.quadraticCurveTo(
      lip.x + 10 + flow * 14,
      lip.y + 10,
      this.pourX(state) + wobble,
      endY
    )
    ctx.stroke()
  }

  /** The floor under the sieve cam: paving outside, boards in the kitchen, bathroom tiles. */
  readonly drawCam = (ctx: CanvasRenderingContext2D): void => {
    const room = this.camRoom
    const x0 = CAM_X - 130
    const y0 = CAM_Y - 130
    ctx.fillStyle =
      room === 'step' ? '#c9c2b6' : room === 'kitchen' ? '#d9b48a' : '#eef6fa'
    ctx.fillRect(x0, y0, 260, 260)
    ctx.strokeStyle =
      room === 'bathroom'
        ? 'rgba(80, 140, 170, 0.35)'
        : 'rgba(80, 50, 20, 0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    const gap = room === 'kitchen' ? 34 : 52
    for (let x = x0; x < x0 + 260; x += gap) {
      ctx.moveTo(x, y0)
      ctx.lineTo(x, y0 + 260)
    }
    if (room !== 'kitchen')
      for (let y = y0; y < y0 + 260; y += gap) {
        ctx.moveTo(x0, y)
        ctx.lineTo(x0 + 260, y)
      }
    ctx.stroke()
  }

  /** The vertical pour gauge with its green band. Drawn only while pouring. */
  drawGauge(ctx: CanvasRenderingContext2D, state: GameState): void {
    const x = POUR_GAUGE_X - 16
    const h = POUR_GAUGE_BOTTOM - POUR_GAUGE_TOP
    const safe = (POUR_SAFE_LPS / POUR_MAX_LPS) * h
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(x, POUR_GAUGE_TOP, 32, h)
    ctx.fillStyle = 'rgba(76, 175, 93, 0.5)'
    ctx.fillRect(x, POUR_GAUGE_BOTTOM - safe, 32, safe)
    ctx.fillStyle = 'rgba(201, 42, 42, 0.18)'
    ctx.fillRect(x, POUR_GAUGE_TOP, 32, h - safe)
    const level = Math.min(1, state.house.flow / POUR_MAX_LPS) * h
    const splashing = state.house.flow > POUR_SAFE_LPS
    ctx.fillStyle = splashing ? palette.red : palette.blue
    ctx.fillRect(x + 6, POUR_GAUGE_BOTTOM - level, 20, level)
    sketchRect(ctx, x, POUR_GAUGE_TOP, 32, h, GAUGE)
    sketchText(ctx, 'Pour', POUR_GAUGE_X, POUR_GAUGE_TOP - 18, POUR_TEXT)
  }
}

const NOOP: GestureHandler = { move() {}, end() {} }

/**
 * Presses on a house visit: a tap on the drinking cat shoos it, and a drag on the pulled
 * plug puts it back in its hole. Other presses are left to wiping and walking.
 */
export class HouseInput {
  constructor(private readonly sim: Sim) {}

  readonly press = (pointer: PointerLike): GestureHandler | null => {
    const sim = this.sim
    const s = sim.state
    if (!sim.canTouchHouse()) return null
    const room = ROOM_FOR[s.containerIndex] ?? 'step'
    const spot = CAT_SPOTS[room]
    const toCat =
      s.cat.mood === 'drinking'
        ? Math.hypot(
            pointer.x - spot.x + spot.facing * 10,
            pointer.y - spot.y + 34
          )
        : Infinity
    const toPlug = s.cat.plugOut
      ? Math.hypot(pointer.x - s.cat.plugX, pointer.y - s.cat.plugY)
      : Infinity
    if (toCat <= CAT_HIT_RADIUS && toCat <= toPlug) {
      sim.shooCat()
      return NOOP
    }
    if (toPlug > PLUG_HIT_RADIUS) return null
    let lastX = pointer.x
    let lastY = pointer.y
    sim.dragPlug(lastX, lastY)
    return {
      move(x, y) {
        lastX = x
        lastY = y
        sim.dragPlug(x, y)
      },
      end(kind) {
        // A pause never fixes anything: the plug swings back to the rim.
        if (kind === 'letGo') sim.dropPlug(lastX, lastY)
        else sim.dropPlug(-1000, -1000)
      }
    }
  }
}
