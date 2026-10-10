import { patchWidth, segmentMiddle, wipeStrokes } from '../game/path'
import type { GameState, Sim } from '../game/sim'
import { stoneRest, stoneSlot } from '../game/stones'
import type { Season } from '../game/types'
import {
  CAM_X,
  CAM_Y,
  GROUND_Y,
  HERO_X_OUT,
  PATH_METRES,
  ROSE_FROM_M,
  ROSE_TO_M,
  SEGMENT_M,
  STONE_HIT_RADIUS,
  UNITS_PER_METRE
} from '../game/tuning'
import {
  CachedLayer,
  hash01,
  palette,
  sketchArrow,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRoundRect,
  sketchText,
  type LayerRect,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import {
  CAM_GROUND_RECT,
  CAM_TILE,
  grassColor,
  GRASS_TOP,
  GROUND_RECT,
  HILLS_RECT,
  HOUSE_RECT,
  paintCamGround,
  paintGround,
  paintHills,
  paintHouse,
  paintSign,
  paintWell,
  SIGN_RECT,
  TILE_WIDTH,
  WELL_RECT
} from './art/backgrounds'
import { drawHero, type HeroFace, type HeroPose } from './art/hero'
import type { GestureHandler, PointerLike } from './input'
import {
  DASH,
  drawRubArea,
  NO_DASH,
  rubBox,
  walkHeroX,
  type RubBox
} from './wipe'

/**
 * Presses on an empty walk while a paving stone is out: pick it up by your feet and drag
 * it into its gap in the path.
 */
export class StoneInput {
  private readonly spot = { x: 0, y: 0 }

  constructor(private readonly sim: Sim) {}

  readonly press = (pointer: PointerLike): GestureHandler | null => {
    const sim = this.sim
    const s = sim.state
    if (s.paused || s.scene !== 'walkBack' || !s.stone.placing) return null
    const rest = stoneRest(s, this.spot)
    const near = Math.hypot(pointer.x - rest.x, pointer.y - rest.y)
    if (near > STONE_HIT_RADIUS) return null
    let lastX = pointer.x
    let lastY = pointer.y
    sim.dragStone(lastX, lastY)
    return {
      move(x, y) {
        lastX = x
        lastY = y
        sim.dragStone(x, y)
      },
      end(kind) {
        // A pause drops the stone back by your feet; only a real let-go lays it.
        if (kind === 'pause') sim.state.stone.held = false
        else sim.dropStone(lastX, lastY)
      }
    }
  }
}

/** Hills scroll at this fraction of the path speed. */
const HILLS_PARALLAX = 0.3
/** The house's back wall starts this far past the end of the path. */
const HOUSE_AT_METRES = PATH_METRES + 0.6
const WELL_AT_METRES = -3.2
const SIGNS: readonly { metres: number; text: string }[] = [
  { metres: 25, text: '25 m' },
  { metres: 50, text: 'Halfway. Sort of.' },
  { metres: 75, text: '75 m' }
]

/**
 * The Garden Path, outbound with water and reversed for the walk back: parallax tiles,
 * props and the hero. The backdrop is shared with the well. Static art is cached.
 */
export class PathScene {
  readonly layers: CachedLayer[] = []
  private readonly hills: CachedLayer
  private readonly ground: CachedLayer
  private readonly house: CachedLayer
  private readonly well: CachedLayer
  private readonly signs: CachedLayer[]
  private readonly camGround: CachedLayer
  private readonly pose: HeroPose = {
    x: HERO_X_OUT,
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
  private camScroll = 0
  private readonly root: CachedLayer
  private readonly rock: CachedLayer
  private readonly rose: CachedLayer
  private readonly paving: CachedLayer
  /** Wet leaf piles, in a few seeded variants. */
  private readonly piles: CachedLayer[] = []
  private readonly spot = { x: 0, y: 0 }
  /** Set by the renderer: a slip in progress (0 to 1), and a mole popping out of a bump. */
  fall = 0
  mole: { index: number; t: number } | null = null
  /** The season the cached tiles show; `setSeason` repaints them. */
  private season: Season = 'summer'
  private readonly seasonal: CachedLayer[]
  private readonly box: RubBox = { x: 0, y: 0, width: 0, height: 0 }

  constructor(private readonly viewport: Viewport) {
    const layer = (
      paint: (ctx: CanvasRenderingContext2D) => void,
      rect: ConstructorParameters<typeof CachedLayer>[2]
    ) => {
      const made = new CachedLayer(viewport, paint, rect)
      this.layers.push(made)
      return made
    }
    this.hills = layer(ctx => paintHills(ctx, this.season), HILLS_RECT)
    this.ground = layer(ctx => paintGround(ctx, this.season), GROUND_RECT)
    this.house = layer(paintHouse, HOUSE_RECT)
    this.well = layer(ctx => paintWell(ctx, this.season), WELL_RECT)
    this.signs = SIGNS.map(sign =>
      layer(ctx => paintSign(ctx, sign.text), SIGN_RECT)
    )
    this.camGround = layer(
      ctx => paintCamGround(ctx, this.season),
      CAM_GROUND_RECT
    )
    this.root = layer(ctx => paintBump(ctx, 'root'), BUMP_RECT)
    this.rock = layer(ctx => paintBump(ctx, 'rock'), BUMP_RECT)
    this.rose = layer(paintRose, ROSE_RECT)
    this.paving = layer(paintPaving, PAVING_RECT)
    for (let i = 0; i < PILE_VARIANTS; i++)
      this.piles.push(layer(ctx => paintLeafPile(ctx, i), PILE_RECT))
    this.seasonal = [this.hills, this.ground, this.well, this.camGround]
  }

  /** Repaints the seasonal tiles when the season changes. Returns true when it did. */
  setSeason(season: Season): boolean {
    if (season === this.season) return false
    this.season = season
    for (const layer of this.seasonal) layer.invalidate()
    return true
  }

  /** Screen x of a point `metres` along the path, with the hero at `heroX`. */
  screenX(metres: number, distance: number, heroX: number): number {
    return heroX + (metres - distance) * UNITS_PER_METRE
  }

  dispose(): void {
    for (const l of this.layers) l.dispose()
  }

  /** Grass, hills and fence scrolled to `scrollUnits`, with the hero at `heroX`. */
  drawBackdrop(
    ctx: CanvasRenderingContext2D,
    scrollUnits: number,
    heroX: number
  ): void {
    this.drawGrass(ctx)
    this.drawTiles(ctx, this.hills, scrollUnits * HILLS_PARALLAX, heroX)
    this.drawTiles(ctx, this.ground, scrollUnits, heroX)
  }

  /** Draws the world part: everything that shakes. */
  drawWorld(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number,
    face: HeroFace
  ): void {
    const back = state.walker.dir < 0
    const empty = state.scene === 'walkBack'
    const heroX = walkHeroX(state)
    const d = state.walker.distance
    this.drawGrass(ctx)
    this.drawTiles(ctx, this.hills, d * UNITS_PER_METRE * HILLS_PARALLAX, heroX)
    this.drawProp(ctx, this.well, WELL_AT_METRES, d, heroX)
    for (let i = 0; i < SIGNS.length; i++) {
      const layer = this.signs[i]
      const sign = SIGNS[i]
      if (layer && sign) this.drawProp(ctx, layer, sign.metres, d, heroX, 735)
    }
    this.drawProp(ctx, this.house, HOUSE_AT_METRES, d, heroX)
    this.drawTiles(ctx, this.ground, d * UNITS_PER_METRE, heroX)
    this.drawPaving(ctx, state, heroX)
    this.drawPatches(ctx, state, heroX, timeMs)
    this.drawBumps(ctx, state, heroX)
    if (state.path.rose)
      this.drawProp(
        ctx,
        this.rose,
        (ROSE_FROM_M + ROSE_TO_M) / 2,
        d,
        heroX,
        ROSE_Y
      )

    const pose = this.pose
    const capacity = state.capacityMl || 1
    pose.x = heroX
    pose.facing = back ? -1 : 1
    pose.stride = state.walker.stride / 0.8
    pose.speed = state.walker.speed
    pose.water = state.sieve.inSieve / capacity
    pose.worry = empty ? 0 : state.steady.total
    pose.despair = face === 'despair'
    pose.smug = face === 'smug'
    pose.tremble = empty ? 0 : Math.min(1, Math.max(0, state.drift.fatigue - 1))
    pose.lean = Math.max(-0.5, Math.min(0.5, state.grip.offsetX * 0.006))
    pose.carrying = !empty
    pose.fall = this.fall
    pose.timeMs = timeMs
    drawHero(ctx, pose)
    // The rub area sits on top, so nothing hides the sponge or the progress.
    const box = rubBox(state, this.box)
    if (box && state.wipe?.target === 'path')
      drawRubArea(ctx, state, box, timeMs)
    if (state.scene === 'walkBack' && state.stone.placing)
      this.drawStone(ctx, state, timeMs)
  }

  /** Flagstones on every paved segment in view. */
  private drawPaving(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    heroX: number
  ): void {
    const view = this.viewport.view
    const half = (SEGMENT_M * UNITS_PER_METRE) / 2
    const stones = state.path.stones
    for (let i = 0; i < stones.length; i++) {
      if (!stones[i]) continue
      const x = this.screenX(segmentMiddle(i), state.walker.distance, heroX)
      if (x + half < view.x || x - half > view.x + view.width) continue
      ctx.save()
      ctx.translate(x, PATCH_Y)
      this.paving.draw(ctx)
      ctx.restore()
    }
  }

  /** The stone to lay: its gap in the path ahead, and the stone by your feet or in hand. */
  private drawStone(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    const slot = stoneSlot(state, this.spot)
    const half = (SEGMENT_M * UNITS_PER_METRE) / 2 - 10
    ctx.setLineDash(DASH)
    sketchRoundRect(ctx, slot.x - half, slot.y - 16, half * 2, 32, 12, GAP)
    ctx.setLineDash(NO_DASH)
    const pulse = Math.sin(timeMs / 150) * 3
    sketchText(ctx, 'Drop it here', slot.x, slot.y - 34 + pulse, DROP_TEXT)
    const stone = state.stone
    const at = stone.held ? stone : stoneRest(state, this.spot)
    STONE.seed = 190
    sketchEllipse(ctx, at.x, at.y, 34, 13, STONE)
  }

  private drawBumps(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    heroX: number
  ): void {
    const view = this.viewport.view
    const path = state.path
    for (let i = 0; i < path.bumps.length; i++) {
      const at = path.bumps[i] ?? 0
      const x = this.screenX(at, state.walker.distance, heroX)
      if (x < view.x - 60 || x > view.x + view.width + 60) continue
      ctx.save()
      ctx.translate(x, BUMP_Y)
      ;(i % 2 === 0 ? this.root : this.rock).draw(ctx)
      ctx.restore()
      if (this.mole?.index === i) drawMole(ctx, x, BUMP_Y, this.mole.t)
    }
  }

  private drawPatches(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    heroX: number,
    timeMs: number
  ): void {
    const view = this.viewport.view
    for (const patch of state.path.patches) {
      const x = this.screenX(patch.at, state.walker.distance, heroX)
      const rx = (patchWidth(patch) * UNITS_PER_METRE) / 2
      if (x + rx < view.x || x - rx > view.x + view.width) continue
      // Rubbing fades it out.
      ctx.globalAlpha = 1 - 0.7 * (patch.wiped / wipeStrokes(patch.kind))
      const pile = this.piles[patch.id % PILE_VARIANTS]
      if (patch.kind === 'leaves' && pile) {
        ctx.save()
        ctx.translate(x, PATCH_Y)
        ctx.scale(rx / PILE_RX, 1)
        pile.draw(ctx)
        ctx.restore()
      } else drawPuddle(ctx, x, rx, patch.kind === 'ice', patch.at, timeMs)
      ctx.globalAlpha = 1
    }
  }

  /** Top-down ground under the sieve cam, scrolling as you walk. */
  readonly drawCamGround = (ctx: CanvasRenderingContext2D): void => {
    const scroll = ((this.camScroll % CAM_TILE) + CAM_TILE) % CAM_TILE
    for (let k = -1; k <= 1; k++) {
      ctx.save()
      ctx.translate(CAM_X, CAM_Y - CAM_TILE / 2 + scroll + k * CAM_TILE)
      this.camGround.draw(ctx)
      ctx.restore()
    }
  }

  /** Sets how far the cam ground has scrolled, from the walker's distance. */
  setCamScroll(distance: number): void {
    this.camScroll = distance * UNITS_PER_METRE * 0.8
  }

  private drawGrass(ctx: CanvasRenderingContext2D): void {
    const view = this.viewport.view
    ctx.fillStyle = grassColor(this.season)
    ctx.fillRect(
      view.x,
      GRASS_TOP,
      view.width,
      view.y + view.height - GRASS_TOP
    )
  }

  private drawProp(
    ctx: CanvasRenderingContext2D,
    layer: CachedLayer,
    metres: number,
    distance: number,
    heroX: number,
    y = GROUND_Y - 6
  ): void {
    const x = heroX + (metres - distance) * UNITS_PER_METRE
    const view = this.viewport.view
    if (x < view.x - 500 || x > view.x + view.width + 100) return
    ctx.save()
    ctx.translate(x, y)
    layer.draw(ctx)
    ctx.restore()
  }

  /** Stamps a seamless tile side by side across the view, scrolled by `scroll` units. */
  private drawTiles(
    ctx: CanvasRenderingContext2D,
    layer: CachedLayer,
    scroll: number,
    heroX: number
  ): void {
    const view = this.viewport.view
    const base = heroX - scroll
    const first = Math.floor((view.x - base) / TILE_WIDTH)
    const last = Math.floor((view.x + view.width - base) / TILE_WIDTH)
    for (let k = first; k <= last; k++) {
      ctx.save()
      ctx.translate(base + k * TILE_WIDTH, 0)
      layer.draw(ctx)
      ctx.restore()
    }
  }
}

/** A puddle, or ice with white shine streaks, on the walk strip. */
function drawPuddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  rx: number,
  ice: boolean,
  seed: number,
  timeMs: number
): void {
  ctx.fillStyle = ice ? 'rgba(208, 235, 255, 0.9)' : 'rgba(116, 192, 252, 0.7)'
  ctx.beginPath()
  ctx.ellipse(x, PATCH_Y, rx, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = palette.blue
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = ice ? 3 : 2
  ctx.beginPath()
  if (ice) {
    // Ice doesn't ripple; it shines in hard streaks.
    ctx.moveTo(x - rx * 0.5, PATCH_Y + 2)
    ctx.lineTo(x - rx * 0.2, PATCH_Y - 4)
    ctx.moveTo(x + rx * 0.1, PATCH_Y + 3)
    ctx.lineTo(x + rx * 0.45, PATCH_Y - 3)
  } else {
    // A glint that moves, so wet ground reads as wet.
    const glint = Math.sin(timeMs / 500 + seed) * rx * 0.4
    ctx.moveTo(x + glint - 8, PATCH_Y - 3)
    ctx.lineTo(x + glint + 8, PATCH_Y - 3)
  }
  ctx.stroke()
}

/** Leaf pile variants, picked by patch id. */
const PILE_VARIANTS = 3
/** Half the width of a fresh 1.5 m pile, in units. */
const PILE_RX = 30
const PILE_RECT: LayerRect = { x: -50, y: -22, width: 100, height: 38 }

/** A soggy heap of autumn leaves, centred on (0, 0), for a cached stamp. */
function paintLeafPile(ctx: CanvasRenderingContext2D, seed: number): void {
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 1.5
  for (let i = 0; i < 9; i++) {
    const lx = (((i * 37 + seed * 13) % 100) / 100 - 0.5) * PILE_RX * 1.8
    const ly = 2 - (i % 3) * 5
    ctx.fillStyle =
      i % 3 === 0 ? palette.yellow : i % 3 === 1 ? palette.orange : '#b5651d'
    ctx.beginPath()
    ctx.ellipse(lx, ly, 10, 5, (i * 0.9) % 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

/** One paved segment: flat grey flagstones across the strip, centred on (0, 0). */
const DROP_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 22,
  outline: palette.paper
}

const PAVING_RECT: LayerRect = { x: -104, y: -22, width: 208, height: 44 }
const FLAG: SketchStyle = {
  fill: '#b9b4ab',
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 2,
  wobble: 1.5
}

function paintPaving(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 5; i++) {
    FLAG.seed = 200 + i
    const x = -80 + i * 40 + (hash01(201, i) - 0.5) * 6
    sketchEllipse(ctx, x, (i % 2) * 4 - 2, 19, 9, FLAG)
  }
}

const STONE: SketchStyle = {
  fill: '#b9b4ab',
  fillStyle: 'hatch',
  hatchGap: 5,
  color: palette.ink,
  width: 2.5,
  wobble: 1.5
}
const GAP: SketchStyle = {
  color: palette.ink,
  width: 2.5,
  wobble: 1.5,
  seed: 191
}

/** Where bumps and puddles sit on the walk strip. */
const BUMP_Y = 782
const PATCH_Y = 784
const BUMP_RECT: LayerRect = { x: -44, y: -96, width: 88, height: 112 }
const ROOT: SketchStyle = {
  color: palette.brown,
  width: 7,
  wobble: 2,
  seed: 150
}
const ROCK: SketchStyle = {
  fill: '#a8a29a',
  fillStyle: 'hatch',
  hatchGap: 5,
  color: palette.ink,
  width: 2.5,
  wobble: 2,
  seed: 151
}
const ARROW: SketchStyle & { head: number } = {
  color: palette.red,
  width: 4,
  wobble: 1.5,
  seed: 152,
  head: 14
}
const rootPoints = new Float64Array([-34, 6, -16, -12, 4, -14, 22, -6, 34, 6])

/** A root or a rock across the path, with a red hand-drawn arrow above it. */
function paintBump(ctx: CanvasRenderingContext2D, kind: 'root' | 'rock'): void {
  if (kind === 'root') sketchPath(ctx, rootPoints, { ...ROOT, smooth: true })
  else sketchEllipse(ctx, 0, -2, 22, 12, ROCK)
  sketchArrow(ctx, 0, -86, 0, -32, ARROW)
}

const MOLE: SketchStyle = {
  fill: '#6b4a32',
  color: palette.ink,
  width: 2.5,
  wobble: 1.5,
  seed: 153
}
const HAT: SketchStyle = {
  fill: palette.yellow,
  color: palette.ink,
  width: 2,
  wobble: 1,
  seed: 154
}

/** A mole in a hard hat pops out of a new bump, then ducks back in. */
function drawMole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number
): void {
  const rise = Math.sin(Math.min(1, t) * Math.PI) * 34
  if (rise < 2) return
  sketchEllipse(ctx, x, y - rise + 10, 16, 18, MOLE)
  sketchEllipse(ctx, x, y - rise - 6, 17, 8, HAT)
  ctx.fillStyle = palette.ink
  ctx.beginPath()
  ctx.arc(x - 5, y - rise + 4, 2, 0, Math.PI * 2)
  ctx.arc(x + 5, y - rise + 4, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = palette.pink
  ctx.beginPath()
  ctx.arc(x, y - rise + 11, 3.5, 0, Math.PI * 2)
  ctx.fill()
}

/** The rose bush straddles the path; (0, 0) is the middle of its stretch on the path. */
const ROSE_Y = 790
const ROSE_HALF = ((ROSE_TO_M - ROSE_FROM_M) / 2) * UNITS_PER_METRE
const ROSE_RECT: LayerRect = {
  x: -ROSE_HALF - 30,
  y: -120,
  width: ROSE_HALF * 2 + 60,
  height: 140
}
const BRAMBLE: SketchStyle = {
  color: '#6b4a32',
  width: 4,
  passes: 1,
  wobble: 2
}
const LEAVES: SketchStyle = {
  fill: palette.green,
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 2,
  wobble: 2
}
const ROSE: SketchStyle = {
  fill: palette.pink,
  color: palette.red,
  width: 2,
  wobble: 1.5
}

/** A thorny rose bush you have to carry the sieve past. */
function paintRose(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 7; i++) {
    const x = -ROSE_HALF + (i / 6) * ROSE_HALF * 2
    LEAVES.seed = 160 + i
    sketchCircle(
      ctx,
      x,
      -40 - hash01(161, i) * 30,
      30 + hash01(162, i) * 10,
      LEAVES
    )
  }
  for (let i = 0; i < 9; i++) {
    const x = -ROSE_HALF - 10 + (i / 8) * (ROSE_HALF * 2 + 20)
    const tipY = -70 - hash01(163, i) * 40
    BRAMBLE.seed = 170 + i
    sketchLine(ctx, x, 8, x + (hash01(164, i) - 0.5) * 50, tipY, BRAMBLE)
    // Thorns.
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let k = 1; k < 4; k++) {
      const ty = (tipY * k) / 4
      ctx.moveTo(x - 2, ty)
      ctx.lineTo(x - 9, ty - 5)
    }
    ctx.stroke()
  }
  for (let i = 0; i < 6; i++) {
    ROSE.seed = 180 + i
    sketchCircle(
      ctx,
      -ROSE_HALF + 20 + (i / 5) * (ROSE_HALF * 2 - 40),
      -60 - hash01(181, i) * 40,
      9,
      ROSE
    )
  }
}
