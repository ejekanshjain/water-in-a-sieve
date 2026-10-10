import { benchHole, benchStage, isSewn, stitchPoint } from '../game/bench'
import type { Hole } from '../game/holes'
import type { GameState, Sim } from '../game/sim'
import {
  BENCH_RADIUS,
  BENCH_X,
  BENCH_Y,
  EYE_HIT,
  REWAX_STROKES,
  STITCH_HIT
} from '../game/tuning'
import {
  CachedLayer,
  palette,
  RubGesture,
  sketchCircle,
  sketchLine,
  sketchRect,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import { drawGloss, drawHole } from './art/sieve'
import type { GestureHandler, PointerLike } from './input'

/** The bench card, the Back chip, the needle's eye, the thread's rest spot and the glue. */
const CARD = { x: 36, y: 246, width: 468, height: 470 }
const BACK = { x: 408, y: 258, width: 86, height: 44 }
export const EYE_Y = 360
const THREAD_REST = { x: BENCH_X, y: 640 }
const SPOOL = { x: 120, y: 660 }
const GLUE = { x: 430, y: 650 }
/** Presses this close to the thread end or the glue grab them. */
const GRAB_RADIUS = 70
/** On the bench the holes draw this much bigger than in the cam. */
const HOLE_SCALE = 2.4

const NOOP: GestureHandler = { move() {}, end() {} }

function inBox(
  box: { x: number; y: number; width: number; height: number },
  x: number,
  y: number
): boolean {
  return (
    x >= box.x &&
    x <= box.x + box.width &&
    y >= box.y &&
    y <= box.y + box.height
  )
}

/**
 * Presses at the open workbench: drag the thread into the swaying eye, drag the needle
 * through the stitch points in order, tap the glue. Back, or a press off the bench, closes it.
 */
export class BenchInput {
  private readonly point = { x: 0, y: 0 }

  constructor(private readonly sim: Sim) {}

  press(pointer: PointerLike, timeMs: number): GestureHandler {
    const sim = this.sim
    const s = sim.state
    if (
      inBox(BACK, pointer.x, pointer.y) ||
      !inBox(CARD, pointer.x, pointer.y)
    ) {
      sim.closeBench()
      return NOOP
    }
    switch (benchStage(s.bench, s.holes)) {
      case 'thread':
        return this.thread(pointer, timeMs)
      case 'sew':
        return this.sew(pointer)
      case 'glue':
        if (Math.hypot(pointer.x - GLUE.x, pointer.y - GLUE.y) < GRAB_RADIUS)
          sim.applyGlue()
        return NOOP
      case 'wax':
        return this.wax(pointer)
    }
  }

  /** Rubs the wax block over the sieve: every back-and-forth stroke waxes a little more. */
  private wax(pointer: PointerLike): GestureHandler {
    const sim = this.sim
    const gesture = new RubGesture({ minAmplitude: 40 })
    let lastX = pointer.x
    let lastY = pointer.y
    sim.benchHand(lastX, lastY, true)
    gesture.add(lastX, lastY)
    return {
      move(x, y) {
        lastX = x
        lastY = y
        sim.benchHand(x, y, true)
        if (gesture.add(x, y) > 0) sim.rubWax()
      },
      end() {
        if (gesture.end() > 0) sim.rubWax()
        sim.benchHand(lastX, lastY, false)
      }
    }
  }

  /** Drags the thread end; letting go over the eye threads the needle. */
  private thread(pointer: PointerLike, startMs: number): GestureHandler {
    const sim = this.sim
    const near = Math.hypot(
      pointer.x - THREAD_REST.x,
      pointer.y - THREAD_REST.y
    )
    if (near > GRAB_RADIUS) return NOOP
    let lastX = pointer.x
    let lastY = pointer.y
    let lastMs = startMs
    sim.benchHand(lastX, lastY, true)
    return {
      move(x, y, timeMs) {
        const dt = Math.max(1, timeMs - lastMs) / 1000
        const speed = Math.hypot(x - lastX, y - lastY) / dt
        lastX = x
        lastY = y
        lastMs = timeMs
        sim.benchHand(x, y, true, speed)
      },
      end(kind) {
        if (kind === 'pause') {
          sim.benchHand(lastX, lastY, false)
          return
        }
        const hit = Math.hypot(lastX - sim.eyeX(), lastY - EYE_Y) <= EYE_HIT
        sim.threadNeedle(hit)
      }
    }
  }

  /** Drags the needle; entering a stitch point sews it, in order or not. */
  private sew(pointer: PointerLike): GestureHandler {
    const sim = this.sim
    const point = this.point
    let inside = -1
    const check = (x: number, y: number) => {
      sim.benchHand(x, y, true)
      const hole = sim.state.holes.find(h => !isSewn(h))
      if (!hole) return
      for (let i = 0; i < hole.points; i++) {
        stitchPoint(hole, i, point)
        if (Math.hypot(x - point.x, y - point.y) > STITCH_HIT) continue
        if (inside !== i) sim.stitch(hole.id, i)
        inside = i
        return
      }
      inside = -1
    }
    check(pointer.x, pointer.y)
    return {
      move: (x, y) => check(x, y),
      end: () => {
        const bench = sim.state.bench
        sim.benchHand(bench.handX, bench.handY, false)
      }
    }
  }
}

const CARD_STYLE: SketchStyle = {
  fill: 'rgba(196, 150, 96, 0.35)',
  fillStyle: 'hatch',
  hatchGap: 10,
  hatchAngle: -0.2,
  color: palette.ink,
  width: 4,
  seed: 601
}
const CHIP: SketchStyle = {
  fill: '#ffffff',
  color: palette.ink,
  width: 3,
  seed: 602
}
const MESH: SketchStyle = {
  fill: 'rgba(120, 120, 120, 0.25)',
  fillStyle: 'hatch',
  hatchGap: 9,
  hatchAngle: 0.8,
  color: palette.inkSoft,
  width: 2,
  wobble: 2,
  seed: 603
}
const RIM: SketchStyle = { color: '#9a6a3a', width: 12, wobble: 2.5, seed: 604 }
const NEEDLE: SketchStyle = {
  color: '#8a9399',
  width: 7,
  passes: 1,
  wobble: 0.5
}
const THREAD: SketchStyle = {
  color: palette.red,
  width: 3,
  passes: 1,
  wobble: 2
}
const SPOOL_STYLE: SketchStyle = {
  fill: palette.red,
  fillStyle: 'hatch',
  hatchGap: 4,
  color: palette.ink,
  width: 2.5,
  seed: 605
}
const TUBE: SketchStyle = {
  fill: '#ffffff',
  color: palette.ink,
  width: 3,
  seed: 606
}
const DOT: SketchStyle = { color: palette.ink, width: 2.5, wobble: 1 }
const CAP_STYLE: SketchStyle = { ...TUBE, fill: palette.red, seed: 640 }
const SPOOL_END: SketchStyle = { width: 5, color: '#c08a55', seed: 612 }
const EYE_DASH = [5, 5]
const NO_DASH: number[] = []

// Text drawn every frame on the bench, hoisted so drawing allocates nothing.
const TITLE_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 30,
  align: 'left',
  tilt: 0.04,
  seed: 608
}
const BACK_TEXT: SketchTextStyle = { font: 'marker', size: 24 }
const RUB_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 40,
  outline: palette.paper
}
const WAX_TEXT: SketchTextStyle = { font: 'marker', size: 16 }
const THREAD_TEXT: SketchTextStyle = { size: 22 }
/** White on a sewn dot, ink on the rest. */
const NUMBER_TEXT: SketchTextStyle = { size: 18, color: palette.ink }
const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const GLUE_TEXT: SketchTextStyle = { font: 'marker', size: 18, rotate: -1.57 }
const WAX_BLOCK: SketchStyle = {
  fill: '#fff4c2',
  color: palette.ink,
  width: 2.5,
  wobble: 1,
  seed: 650
}

const FINE_MESH: SketchStyle = { ...MESH, hatchGap: 5 }
const FINE_CROSS: SketchStyle = {
  ...MESH,
  hatchGap: 5,
  hatchAngle: -0.8,
  width: 0,
  seed: 614
}

/** The big sieve on the bench, painted once; Finer Mesh cross-hatches it tighter. */
function paintBenchSieve(ctx: CanvasRenderingContext2D, fine: boolean): void {
  sketchCircle(ctx, 0, 0, BENCH_RADIUS - 8, fine ? FINE_MESH : MESH)
  if (fine) sketchCircle(ctx, 0, 0, BENCH_RADIUS - 8, FINE_CROSS)
  sketchCircle(ctx, 0, 0, BENCH_RADIUS, RIM)
  sketchCircle(ctx, 0, 0, BENCH_RADIUS + 8, { width: 2.5, seed: 607 })
}

/**
 * Draws the workbench over the well: the card, Back, and the current step: threading the
 * swaying needle, sewing the stitch points in order, or the glue.
 */
export class BenchView {
  readonly layers: CachedLayer[]
  private readonly sieve: CachedLayer
  private readonly fineSieve: CachedLayer
  private readonly point = { x: 0, y: 0 }
  private readonly centre = { x: 0, y: 0 }

  constructor(private readonly viewport: Viewport) {
    const r = BENCH_RADIUS + 16
    const rect = { x: -r, y: -r, width: r * 2, height: r * 2 }
    this.sieve = new CachedLayer(
      viewport,
      ctx => paintBenchSieve(ctx, false),
      rect
    )
    this.fineSieve = new CachedLayer(
      viewport,
      ctx => paintBenchSieve(ctx, true),
      rect
    )
    this.layers = [this.sieve, this.fineSieve]
  }

  draw(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    eyeX: number,
    timeMs: number
  ): void {
    const view = this.viewport.view
    ctx.fillStyle = 'rgba(253, 246, 227, 0.82)'
    ctx.fillRect(view.x, view.y, view.width, view.height)
    // A solid top, then the wood grain over it.
    ctx.fillStyle = '#f6e6c8'
    ctx.fillRect(CARD.x + 4, CARD.y + 4, CARD.width - 8, CARD.height - 8)
    sketchRoundRect(
      ctx,
      CARD.x,
      CARD.y,
      CARD.width,
      CARD.height,
      22,
      CARD_STYLE
    )
    sketchText(
      ctx,
      'Workbench',
      CARD.x + 26,
      BACK.y + BACK.height / 2,
      TITLE_TEXT
    )
    sketchRoundRect(ctx, BACK.x, BACK.y, BACK.width, BACK.height, 12, CHIP)
    sketchText(
      ctx,
      'Back',
      BACK.x + BACK.width / 2,
      BACK.y + BACK.height / 2,
      BACK_TEXT
    )
    const stage = benchStage(state.bench, state.holes)
    if (stage === 'wax') this.drawWaxing(ctx, state, timeMs)
    else if (stage === 'thread') this.drawThreading(ctx, state, eyeX, timeMs)
    else this.drawSewing(ctx, state, stage === 'glue', timeMs)
  }

  /** The sieve with gloss streaks building up as you rub, and the wax block in your hand. */
  private drawWaxing(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number
  ): void {
    ctx.save()
    ctx.translate(BENCH_X, BENCH_Y)
    ;(state.gear.finerMesh ? this.fineSieve : this.sieve).draw(ctx)
    ctx.restore()
    const progress = state.kit.waxRubbed / REWAX_STROKES
    drawGloss(ctx, BENCH_X, BENCH_Y, BENCH_RADIUS - 20, progress, 4)
    // Progress along the card's foot.
    const x = CARD.x + 60
    const w = CARD.width - 120
    const y = CARD.y + CARD.height - 30
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(x, y, w, 12)
    ctx.fillStyle = palette.yellow
    ctx.fillRect(x, y, w * progress, 12)
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, 12)
    const bench = state.bench
    if (!bench.holding) {
      const bob = Math.sin(timeMs / 180) * 4
      sketchText(ctx, 'Rub!', BENCH_X, BENCH_Y + bob, RUB_TEXT)
      return
    }
    ctx.save()
    ctx.translate(bench.handX, bench.handY)
    ctx.rotate(Math.sin(timeMs / 60) * 0.15)
    sketchRoundRect(ctx, -26, -16, 52, 32, 8, WAX_BLOCK)
    sketchText(ctx, 'Wax', 0, 1, WAX_TEXT)
    ctx.restore()
  }

  private drawThreading(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    eyeX: number,
    timeMs: number
  ): void {
    // The needle hangs point down; its eye sways.
    NEEDLE.seed = 610
    sketchLine(ctx, eyeX, EYE_Y - 30, eyeX + 4, 600, NEEDLE)
    ctx.fillStyle = '#fdf6e3'
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(eyeX, EYE_Y, 6, 15, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // A faint ring shows how close the thread must get.
    ctx.strokeStyle = 'rgba(201, 42, 42, 0.35)'
    ctx.lineWidth = 2
    ctx.setLineDash(EYE_DASH)
    ctx.beginPath()
    ctx.arc(eyeX, EYE_Y, 12 + 3 * Math.sin(timeMs / 200), 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash(NO_DASH)
    const bench = state.bench
    const tx = bench.holding ? bench.handX : THREAD_REST.x
    const ty = bench.holding ? bench.handY : THREAD_REST.y
    this.drawSpool(ctx)
    THREAD.seed = 611
    sketchLine(ctx, SPOOL.x + 20, SPOOL.y - 10, tx, ty, THREAD)
    ctx.fillStyle = palette.red
    ctx.beginPath()
    ctx.arc(tx, ty, 7, 0, Math.PI * 2)
    ctx.fill()
    if (!bench.holding) {
      // Wiggle the thread end so you know it's the thing to grab.
      const bob = Math.sin(timeMs / 180) * 4
      sketchText(ctx, 'Thread', tx, ty + 34 + bob, THREAD_TEXT)
    }
  }

  private drawSpool(ctx: CanvasRenderingContext2D): void {
    sketchRect(ctx, SPOOL.x - 18, SPOOL.y - 26, 36, 52, SPOOL_STYLE)
    SPOOL_END.seed = 612
    sketchLine(
      ctx,
      SPOOL.x - 26,
      SPOOL.y - 28,
      SPOOL.x + 26,
      SPOOL.y - 28,
      SPOOL_END
    )
    SPOOL_END.seed = 613
    sketchLine(
      ctx,
      SPOOL.x - 26,
      SPOOL.y + 28,
      SPOOL.x + 26,
      SPOOL.y + 28,
      SPOOL_END
    )
  }

  private drawSewing(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    glue: boolean,
    timeMs: number
  ): void {
    ctx.save()
    ctx.translate(BENCH_X, BENCH_Y)
    ;(state.gear.finerMesh ? this.fineSieve : this.sieve).draw(ctx)
    ctx.restore()
    let current: Hole | null = null
    for (const hole of state.holes)
      if (!current && !isSewn(hole)) current = hole
    const point = this.point
    const centre = this.centre
    for (const hole of state.holes) {
      benchHole(hole, centre)
      ctx.save()
      ctx.translate(centre.x, centre.y)
      ctx.scale(HOLE_SCALE, HOLE_SCALE)
      drawHole(ctx, 0, 0, hole.seed, 0, hole.points)
      ctx.restore()
      // Stitches pull the hole shut: thread from each sewn point across the middle.
      ctx.strokeStyle = palette.red
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let i = 0; i < hole.stitched; i++) {
        stitchPoint(hole, i, point)
        ctx.moveTo(point.x, point.y)
        ctx.lineTo(centre.x, centre.y)
      }
      ctx.stroke()
      if (hole !== current) continue
      for (let i = 0; i < hole.points; i++) {
        stitchPoint(hole, i, point)
        const done = i < hole.stitched
        const next = i === hole.stitched
        DOT.seed = 620 + i
        DOT.fill = done ? palette.red : next ? palette.yellow : '#ffffff'
        const r = next ? 13 + 2 * Math.sin(timeMs / 150) : 12
        sketchCircle(ctx, point.x, point.y, r, DOT)
        NUMBER_TEXT.color = done ? '#ffffff' : palette.ink
        sketchText(ctx, NUMBERS[i] ?? '', point.x, point.y + 1, NUMBER_TEXT)
      }
    }
    const bench = state.bench
    if (bench.holding && current) {
      // Thread trails from the last stitch to the needle in your hand.
      if (current.stitched > 0) {
        stitchPoint(current, current.stitched - 1, point)
        THREAD.seed = 630
        sketchLine(ctx, point.x, point.y, bench.handX, bench.handY, THREAD)
      }
      NEEDLE.seed = 631
      sketchLine(
        ctx,
        bench.handX,
        bench.handY,
        bench.handX + 30,
        bench.handY - 30,
        NEEDLE
      )
    }
    if (glue) this.drawGlue(ctx, timeMs)
  }

  private drawGlue(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const pulse = 1 + 0.08 * Math.sin(timeMs / 140)
    ctx.save()
    ctx.translate(GLUE.x, GLUE.y)
    ctx.scale(pulse, pulse)
    ctx.rotate(-0.4)
    sketchRoundRect(ctx, -22, -40, 44, 70, 10, TUBE)
    sketchRect(ctx, -10, -58, 20, 18, CAP_STYLE)
    sketchText(ctx, 'Glue', 0, -4, GLUE_TEXT)
    ctx.restore()
  }
}
