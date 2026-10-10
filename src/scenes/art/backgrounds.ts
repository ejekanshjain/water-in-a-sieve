import type { Season } from '../../game/types'
import {
  hash01,
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
  type SketchStyle
} from '../../shared'

/**
 * Static art for the garden path, painted once into `CachedLayer`s. Tiles are seamless
 * over TILE_WIDTH units and get stamped side by side, so any view width is covered.
 */

/** Width of every repeating background tile, wider than the widest expected view. */
export const TILE_WIDTH = 1600

/** Far hills, drawn behind the fence with parallax. */
export const HILLS_RECT: LayerRect = {
  x: 0,
  y: 520,
  width: TILE_WIDTH,
  height: 220
}
/** Fence, verge and the dirt path strip the hero walks on. */
export const GROUND_RECT: LayerRect = {
  x: 0,
  y: 660,
  width: TILE_WIDTH,
  height: 170
}
/** Grass below the path: plain fill, not cached. */
export const GRASS_TOP = 800
export const GRASS_COLOR = '#dcebc6'

/** Grass for each season: green, straw, snow and fresh spring green. */
const GRASS: Record<Season, string> = {
  summer: GRASS_COLOR,
  autumn: '#e9dfb4',
  winter: '#eef4f8',
  spring: '#d2edbf'
}

export function grassColor(season: Season): string {
  return GRASS[season]
}

/** Tree tops and grass tufts for each season. */
const CANOPY: Record<Season, string> = {
  summer: palette.green,
  autumn: palette.orange,
  winter: palette.inkSoft,
  spring: palette.green
}
const TUFT_COLOR: Record<Season, string> = {
  summer: palette.green,
  autumn: '#b08a3e',
  winter: '#c5d6e0',
  spring: palette.green
}
const SNOW: SketchStyle = {
  fill: '#ffffff',
  color: '#c5d6e0',
  width: 1.5,
  wobble: 1.5
}
const BLOSSOM = '#f7a8c4'

const HILL_LINE: SketchStyle & { smooth: boolean } = {
  color: palette.inkSoft,
  width: 2,
  seed: 4,
  smooth: true
}
const TREE: SketchStyle = {
  fill: palette.green,
  fillStyle: 'hatch',
  hatchGap: 7,
  color: palette.inkSoft,
  width: 2
}
const TRUNK: SketchStyle = { color: palette.brown, width: 4, passes: 1 }
const hillPoints = new Float64Array(2 * 41)

/** Paints the hills tile for a season. Periods divide TILE_WIDTH, so the ends meet. */
export function paintHills(
  ctx: CanvasRenderingContext2D,
  season: Season = 'summer'
): void {
  const steps = 40
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * TILE_WIDTH
    const y =
      640 -
      40 * Math.sin((x / 800) * Math.PI * 2) -
      22 * Math.sin((x / 400) * Math.PI * 2 + 1.3)
    hillPoints[i * 2] = x
    hillPoints[i * 2 + 1] = y
  }
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, 760)
  for (let i = 0; i <= steps; i++)
    ctx.lineTo(hillPoints[i * 2] ?? 0, hillPoints[i * 2 + 1] ?? 0)
  ctx.lineTo(TILE_WIDTH, 760)
  ctx.closePath()
  ctx.fillStyle = palette.paperDark
  ctx.fill()
  ctx.restore()
  if (season === 'winter') {
    // Snow lies along every hilltop.
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 10
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const x = hillPoints[i * 2] ?? 0
      const y = (hillPoints[i * 2 + 1] ?? 0) + 5
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  sketchPath(ctx, hillPoints, HILL_LINE, steps + 1)
  for (let i = 0; i < 6; i++) {
    const x = 120 + i * 260 + hash01(11, i) * 60
    const y = 650 - 30 * hash01(12, i)
    const r = 26 + 10 * hash01(13, i)
    TREE.seed = 30 + i
    TRUNK.seed = 40 + i
    sketchLine(ctx, x, y + 30, x, y + 70, TRUNK)
    if (season === 'winter') {
      // Bare branches with a little snow.
      sketchLine(ctx, x, y + 34, x - 18, y + 4, TRUNK)
      sketchLine(ctx, x, y + 28, x + 16, y + 2, TRUNK)
      SNOW.seed = 45 + i
      sketchCircle(ctx, x - 16, y + 4, 5, SNOW)
      continue
    }
    TREE.fill = CANOPY[season]
    sketchCircle(ctx, x, y + 10, r, TREE)
    if (season === 'spring') {
      ctx.fillStyle = BLOSSOM
      for (let k = 0; k < 5; k++) {
        ctx.beginPath()
        ctx.arc(
          x + Math.cos(k * 1.3) * r * 0.6,
          y + 10 + Math.sin(k * 1.3) * r * 0.6,
          4,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
    }
  }
  TREE.fill = palette.green
}

const POST: SketchStyle = {
  fill: '#c08a55',
  color: palette.ink,
  width: 2.5,
  wobble: 2
}
const RAIL: SketchStyle = { color: palette.brown, width: 4, wobble: 2 }
const PATH_DIRT: SketchStyle = {
  fill: '#d9a066',
  fillStyle: 'hatch',
  hatchGap: 9,
  hatchAngle: -0.3,
  color: palette.brown,
  width: 2.5,
  wobble: 2,
  seed: 5
}
const PATH_BASE = '#ecc896'
const TUFT: SketchStyle = {
  color: palette.green,
  width: 2,
  passes: 1,
  wobble: 1.5
}
const PEBBLE: SketchStyle = {
  fill: '#cfc6b8',
  color: palette.inkSoft,
  width: 1.5,
  wobble: 1
}

/** Paints the fence, verge and path tile for a season. */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  season: Season = 'summer'
): void {
  const grass = GRASS[season]
  // Verge behind the path.
  ctx.fillStyle = grass
  ctx.fillRect(0, 735, TILE_WIDTH, 30)
  for (let rail = 0; rail < 2; rail++) {
    RAIL.seed = 60 + rail
    sketchLine(
      ctx,
      -10,
      690 + rail * 26,
      TILE_WIDTH + 10,
      690 + rail * 26,
      RAIL
    )
  }
  for (let i = 0; i < TILE_WIDTH / 80; i++) {
    POST.seed = 70 + i
    sketchRect(ctx, 34 + i * 80, 676, 12, 70, POST)
    if (season === 'winter') {
      SNOW.seed = 90 + i
      sketchEllipse(ctx, 40 + i * 80, 675, 10, 5, SNOW)
    }
  }
  // The dirt path the hero walks on.
  ctx.fillStyle = PATH_BASE
  ctx.fillRect(0, 760, TILE_WIDTH, 45)
  sketchRect(ctx, -10, 760, TILE_WIDTH + 20, 45, PATH_DIRT)
  ctx.fillStyle = grass
  ctx.fillRect(0, 805, TILE_WIDTH, 30)
  TUFT.color = TUFT_COLOR[season]
  for (let i = 0; i < 48; i++) {
    const x = (i + hash01(21, i)) * (TILE_WIDTH / 48)
    const y = 758 + (i % 2) * 50
    TUFT.seed = 80 + i
    sketchLine(ctx, x, y, x - 4, y - 12, TUFT)
    sketchLine(ctx, x + 3, y, x + 6, y - 10, TUFT)
  }
  TUFT.color = palette.green
  paintSeasonDetails(ctx, season)
  for (let i = 0; i < 18; i++) {
    PEBBLE.seed = 100 + i
    sketchEllipse(
      ctx,
      (i + hash01(22, i)) * (TILE_WIDTH / 18),
      772 + hash01(23, i) * 26,
      5 + hash01(24, i) * 4,
      3,
      PEBBLE
    )
  }
}

/** Fallen leaves in autumn, flowers in spring, and snow drifts in winter, along the verge. */
function paintSeasonDetails(
  ctx: CanvasRenderingContext2D,
  season: Season
): void {
  if (season === 'summer') return
  for (let i = 0; i < 40; i++) {
    const x = (i + hash01(25, i)) * (TILE_WIDTH / 40)
    const y = 745 + hash01(26, i) * 14
    if (season === 'autumn') {
      ctx.fillStyle = i % 3 === 0 ? palette.yellow : palette.orange
      ctx.beginPath()
      ctx.ellipse(x, y, 7, 3.5, hash01(27, i) * 3, 0, Math.PI * 2)
      ctx.fill()
    } else if (season === 'spring') {
      ctx.fillStyle = i % 2 === 0 ? BLOSSOM : palette.yellow
      ctx.beginPath()
      ctx.arc(x, y - 4, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = palette.green
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + 8)
      ctx.stroke()
    } else if (i % 2 === 0) {
      SNOW.seed = 130 + i
      sketchEllipse(ctx, x, y + 6, 22, 7, SNOW)
    }
  }
}

/** The house at the end of the path. (0, 0) is the bottom of the back wall's left edge. */
export const HOUSE_RECT: LayerRect = {
  x: -40,
  y: -360,
  width: 420,
  height: 380
}

const WALL: SketchStyle = {
  fill: '#fff8ea',
  color: palette.ink,
  width: 3,
  seed: 3
}
const ROOF: SketchStyle = {
  fill: palette.red,
  fillStyle: 'hatch',
  hatchGap: 8,
  color: palette.ink,
  width: 3,
  seed: 6
}
const DOOR: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  seed: 8
}
const WINDOW: SketchStyle = {
  fill: '#d6ecfb',
  color: palette.ink,
  width: 3,
  seed: 9
}
const STEP: SketchStyle = {
  fill: '#c9c2b6',
  color: palette.ink,
  width: 2.5,
  seed: 10
}
const roofPoints = new Float64Array([-30, -250, 160, -345, 350, -250])

export function paintHouse(ctx: CanvasRenderingContext2D): void {
  sketchRect(ctx, 0, -250, 320, 250, WALL)
  sketchPolygon(ctx, roofPoints, ROOF)
  sketchRect(ctx, 30, -160, 80, 160, DOOR)
  sketchCircle(ctx, 98, -80, 4, { fill: palette.yellow, width: 1.5 })
  sketchRect(ctx, 170, -190, 100, 80, WINDOW)
  sketchLine(ctx, 220, -190, 220, -110, { width: 2 })
  sketchLine(ctx, 170, -150, 270, -150, { width: 2 })
  sketchRect(ctx, 10, -12, 130, 14, STEP)
}

/** A signpost with a hand-lettered board. (0, 0) is the foot of the post. */
export const SIGN_RECT: LayerRect = { x: -90, y: -130, width: 180, height: 140 }
const SIGN_BOARD: SketchStyle = {
  fill: '#f3d9a8',
  color: palette.ink,
  width: 2.5,
  seed: 12
}
const SIGN_POST: SketchStyle = { color: palette.brown, width: 6, passes: 1 }

export function paintSign(ctx: CanvasRenderingContext2D, text: string): void {
  sketchLine(ctx, 0, 0, 0, -80, SIGN_POST)
  sketchRoundRect(ctx, -80, -122, 160, 50, 8, SIGN_BOARD)
  sketchText(ctx, text, 0, -97, { size: 22, tilt: 0.05, seed: text.length })
}

/** A small well at the start of the path. (0, 0) is the ground under its middle. */
export const WELL_RECT: LayerRect = { x: -80, y: -200, width: 160, height: 210 }
const BRICKS: SketchStyle = {
  fill: '#b8b0a4',
  fillStyle: 'hatch',
  hatchGap: 7,
  color: palette.ink,
  width: 3,
  seed: 14
}
const WELL_ROOF: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  seed: 15
}
const wellRoof = new Float64Array([-70, -130, 0, -190, 70, -130])

export function paintWell(
  ctx: CanvasRenderingContext2D,
  season: Season = 'summer'
): void {
  sketchRect(ctx, -55, -70, 110, 70, BRICKS)
  sketchEllipse(ctx, 0, -70, 55, 12, { fill: '#4a6b80', width: 3, seed: 16 })
  sketchLine(ctx, -48, -70, -48, -130, { width: 4, color: palette.brown })
  sketchLine(ctx, 48, -70, 48, -130, { width: 4, color: palette.brown })
  sketchPolygon(ctx, wellRoof, WELL_ROOF)
  if (season === 'winter') {
    SNOW.seed = 17
    sketchPolygon(ctx, wellSnow, SNOW)
  }
}

const wellSnow = new Float64Array([-62, -134, 0, -186, 62, -134, 0, -170])

/** Top-down ground under the sieve cam, repeating vertically every CAM_TILE units. */
export const CAM_TILE = 240
export const CAM_GROUND_RECT: LayerRect = {
  x: -130,
  y: 0,
  width: 260,
  height: CAM_TILE
}
const CAM_DIRT = '#e2b57f'

export function paintCamGround(
  ctx: CanvasRenderingContext2D,
  season: Season = 'summer'
): void {
  ctx.fillStyle = GRASS[season]
  ctx.fillRect(-130, 0, 260, CAM_TILE)
  ctx.fillStyle = CAM_DIRT
  ctx.fillRect(-70, 0, 140, CAM_TILE)
  for (let i = 0; i < 14; i++) {
    PEBBLE.seed = 200 + i
    sketchEllipse(
      ctx,
      -60 + hash01(31, i) * 120,
      (i / 14) * CAM_TILE + 8,
      4 + hash01(32, i) * 5,
      3 + hash01(33, i) * 3,
      PEBBLE
    )
  }
  TUFT.color = TUFT_COLOR[season]
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const x = side * (90 + hash01(34, i) * 30)
    const y = (i / 10) * CAM_TILE + 12
    TUFT.seed = 220 + i
    sketchLine(ctx, x, y, x - 5, y - 12, TUFT)
    sketchLine(ctx, x + 4, y, x + 7, y - 11, TUFT)
  }
  TUFT.color = palette.green
}
