import { patchById } from '../game/path'
import type { GameState, Sim } from '../game/sim'
import {
  FLOOR_PUDDLE_M,
  GROUND_Y,
  HERO_X_BACK,
  HERO_X_OUT,
  HOUSE_HERO_START,
  UNITS_PER_METRE
} from '../game/tuning'
import {
  palette,
  RubGesture,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../shared'
import type { GestureHandler, PointerLike } from './input'

/** Where the house floor puddle sits: on the walk-in, so it's a hazard as well as a chore. */
export const FLOOR_PUDDLE_X =
  HOUSE_HERO_START + FLOOR_PUDDLE_M * UNITS_PER_METRE
const BOX_HALF_W = 110
/** The box stays above the phone's bottom band, which starts at y 820. */
const BOX_TOP = GROUND_Y - 72
const BOX_HEIGHT = 112

export interface RubBox {
  x: number
  y: number
  width: number
  height: number
}

/** The hero's screen x on an empty walk: leading on the way out, trailing on the way back. */
export function walkHeroX(state: GameState): number {
  return state.walker.dir < 0 ? HERO_X_BACK : HERO_X_OUT
}

/** The rub area around the patch or floor puddle you're wiping, or null. */
export function rubBox(state: GameState, out: RubBox): RubBox | null {
  const wipe = state.wipe
  if (!wipe) return null
  let x = FLOOR_PUDDLE_X
  if (wipe.target === 'path') {
    const patch = patchById(state.path, wipe.patchId)
    if (!patch) return null
    x = walkHeroX(state) + (patch.at - state.walker.distance) * UNITS_PER_METRE
  }
  out.x = x - BOX_HALF_W
  out.y = BOX_TOP
  out.width = BOX_HALF_W * 2
  out.height = BOX_HEIGHT
  return out
}

/** Rubbing progress on the open rub area, 0 to 1. */
export function rubProgress(state: GameState): number {
  const wipe = state.wipe
  if (!wipe) return 0
  const done =
    wipe.target === 'floor'
      ? state.house.floorWiped
      : (patchById(state.path, wipe.patchId)?.wiped ?? 0)
  return Math.min(1, done / wipe.needed)
}

/**
 * Presses in the open rub area: drag back and forth and every stroke rubs. Presses
 * anywhere else are left to walking and gripping.
 */
export class WipeInput {
  private readonly box: RubBox = { x: 0, y: 0, width: 0, height: 0 }

  constructor(private readonly sim: Sim) {}

  readonly press = (pointer: PointerLike): GestureHandler | null => {
    const sim = this.sim
    const s = sim.state
    if (s.paused || (s.scene !== 'walkBack' && s.scene !== 'house')) return null
    const box = rubBox(s, this.box)
    if (!box) return null
    const inside =
      pointer.x >= box.x &&
      pointer.x <= box.x + box.width &&
      pointer.y >= box.y &&
      pointer.y <= box.y + box.height
    if (!inside) return null
    const gesture = new RubGesture({ minAmplitude: 40 })
    let lastX = pointer.x
    let lastY = pointer.y
    sim.wipeHand(lastX, lastY, true)
    gesture.add(lastX, lastY)
    return {
      move(x, y) {
        lastX = x
        lastY = y
        sim.wipeHand(x, y, true)
        if (gesture.add(x, y) > 0) sim.rub()
      },
      end() {
        if (gesture.end() > 0) sim.rub()
        sim.wipeHand(lastX, lastY, false)
      }
    }
  }
}

const BOX: SketchStyle = {
  color: palette.ink,
  width: 2.5,
  wobble: 1.5,
  seed: 701
}
const RUB_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 26,
  outline: palette.paper
}
/** Dashes for dashed outlines, shared so drawing allocates no arrays. */
export const DASH = [8, 7]
export const NO_DASH: number[] = []
const SPONGE: SketchStyle = {
  fill: palette.yellow,
  fillStyle: 'hatch',
  hatchGap: 4,
  color: palette.ink,
  width: 2.5,
  wobble: 1,
  seed: 702
}

/**
 * Draws the rub area: a dashed box over the mess, a progress bar, and the sponge under
 * your pointer.
 */
export function drawRubArea(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  box: RubBox,
  timeMs: number
): void {
  const progress = rubProgress(state)
  ctx.setLineDash(DASH)
  sketchRoundRect(ctx, box.x, box.y, box.width, box.height, 18, BOX)
  ctx.setLineDash(NO_DASH)
  const cx = box.x + box.width / 2
  const ice =
    state.wipe?.target === 'path' &&
    patchById(state.path, state.wipe.patchId)?.kind === 'ice'
  sketchText(
    ctx,
    ice ? 'Scrape!' : 'Rub!',
    cx,
    box.y - 18 + Math.sin(timeMs / 150) * 3,
    RUB_TEXT
  )
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.fillRect(box.x + 20, box.y + box.height - 16, box.width - 40, 10)
  ctx.fillStyle = palette.green
  ctx.fillRect(
    box.x + 20,
    box.y + box.height - 16,
    (box.width - 40) * progress,
    10
  )
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2
  ctx.strokeRect(box.x + 20, box.y + box.height - 16, box.width - 40, 10)
  const wipe = state.wipe
  if (!wipe?.holding) return
  ctx.save()
  ctx.translate(wipe.handX, wipe.handY)
  ctx.rotate(Math.sin(timeMs / 60) * 0.15)
  sketchRoundRect(ctx, -22, -12, 44, 24, 6, SPONGE)
  ctx.restore()
}
