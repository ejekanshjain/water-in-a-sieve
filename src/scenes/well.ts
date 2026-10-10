import { REWAX_CHORE } from '../game/chores'
import { canHangSlippers } from '../game/kit'
import { crankHandle, type GameState, type Sim } from '../game/sim'
import {
  CAM_X,
  CAM_Y,
  CRANK_HIT_RADIUS,
  CRANK_RADIUS,
  CRANK_X,
  CRANK_Y,
  FROG_HIT_RADIUS,
  GROUND_Y,
  HOOK_X,
  HOOK_Y,
  LINE_HIT_RADIUS,
  LINE_SLIPPERS_X,
  LINE_SLIPPERS_Y,
  TIN_HIT_RADIUS,
  WAX_TIN_X,
  WAX_TIN_Y,
  WELL_RIM_Y,
  WELL_X
} from '../game/tuning'
import { crankNeeded, waterLineY } from '../game/well'
import {
  CachedLayer,
  CircleGesture,
  formatClock,
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchPolygon,
  sketchRect,
  sketchText,
  timeLeftMs,
  timerProgress,
  type RealTimer,
  type SketchStyle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import { drawHero, type HeroFace, type HeroPose } from './art/hero'
import { BenchInput } from './bench'
import type { GestureHandler, PointerLike } from './input'
import type { LeafPond } from './leaves'
import type { PathScene } from './path'

/** Where the hero stands at the well, facing the crank and the bucket. */
const HERO_X = 500
const SHOULDER_X = 488
const SHOULDER_Y = GROUND_Y - 154
/** Bucket geometry: half widths at the top and bottom, and its height. */
const BUCKET_TOP_HALF = 44
const BUCKET_BOTTOM_HALF = 33
const BUCKET_HEIGHT = 60
/** The bucket rises from here (hidden in the well) to its raised top. */
const BUCKET_LOW_Y = 700
const BUCKET_UP_Y = 588
const BEAM_Y = 512

/**
 * Turns presses at the well into gestures: circles on the crank, dragging the frog or a
 * leaf, and everything at the workbench. A press on a holey, empty sieve opens the bench.
 * Everything else grips the sieve.
 */
export class WellInput {
  private readonly bench: BenchInput

  constructor(
    private readonly sim: Sim,
    private readonly pond: LeafPond
  ) {
    this.bench = new BenchInput(sim)
  }

  readonly press = (
    pointer: PointerLike,
    timeMs: number
  ): GestureHandler | null => {
    const s = this.sim.state
    // While paused, a press only grips, which resumes the game.
    if (s.scene !== 'well' || s.paused) return null
    if (s.bench.open) return this.bench.press(pointer, timeMs)
    const well = s.well
    if (well.frog === 'on') {
      const knob = crankHandle(well.crankAngle)
      if (Math.hypot(pointer.x - knob.x, pointer.y - knob.y) < FROG_HIT_RADIUS)
        return this.frog()
    }
    if (this.sim.canClearLeaves()) {
      const leaf = this.pond.hit(pointer.x, pointer.y)
      if (leaf >= 0) return this.leaf(leaf, pointer)
    }
    const sim = this.sim
    const near = (x: number, y: number, r: number) =>
      Math.hypot(pointer.x - x, pointer.y - y) < r
    if (
      canHangSlippers(sim) &&
      near(LINE_SLIPPERS_X, LINE_SLIPPERS_Y, LINE_HIT_RADIUS) &&
      sim.hangSlippers()
    )
      return NOOP
    if (
      sim.chores.has(REWAX_CHORE.id) &&
      near(WAX_TIN_X, WAX_TIN_Y, TIN_HIT_RADIUS) &&
      sim.openBench('wax')
    )
      return NOOP
    const onCrank =
      Math.hypot(pointer.x - CRANK_X, pointer.y - CRANK_Y) < CRANK_HIT_RADIUS
    if (!well.bucketUp && onCrank) return this.crank(timeMs)
    if (s.holes.length > 0 && s.sieve.inSieve === 0 && this.sim.openBench())
      return NOOP
    return null
  }

  private crank(startMs: number): GestureHandler {
    const sim = this.sim
    const gesture = new CircleGesture({ center: { x: CRANK_X, y: CRANK_Y } })
    let lastCircleAt = startMs
    return {
      move(x, y, timeMs) {
        const done = gesture.add(x, y, timeMs)
        const angle = Math.atan2(y - CRANK_Y, x - CRANK_X)
        // Only clockwise progress raises the bucket.
        sim.setCrank(gesture.turn > 0 ? gesture.progress : 0, angle)
        if (done > 0) {
          sim.crankCircle(gesture.direction < 0 ? -1 : 1, timeMs - lastCircleAt)
          lastCircleAt = timeMs
        }
      },
      end(kind) {
        if (kind === 'letGo') sim.crankLetGo()
        sim.setCrank(0, sim.state.well.crankAngle)
        gesture.reset()
      }
    }
  }

  /** Drags a leaf: drop it past the water's edge and it's out. */
  private leaf(id: number, pointer: PointerLike): GestureHandler | null {
    const pond = this.pond
    if (!pond.grab(id, pointer.x, pointer.y)) return null
    return {
      move(x, y) {
        pond.moveDrag(x, y)
      },
      end(kind) {
        pond.release(kind === 'letGo')
      }
    }
  }

  private frog(): GestureHandler {
    const sim = this.sim
    let lastX = 0
    let lastY = 0
    return {
      move(x, y) {
        lastX = x
        lastY = y
        sim.dragFrog(x, y)
      },
      end() {
        const knob = crankHandle(sim.state.well.crankAngle)
        // A tap without a drag drops the frog where it sat.
        sim.dropFrog(lastX || knob.x, lastY || knob.y)
      }
    }
  }
}

const NOOP: GestureHandler = { move() {}, end() {} }

/** The Bigger Sieve at the well: bigger, but it still has to dip into the bucket. */
const BIG_AT_WELL = 1.25

const WOOD: SketchStyle = {
  color: palette.brown,
  width: 7,
  passes: 1,
  wobble: 2
}
const ROOF: SketchStyle = {
  fill: palette.brown,
  fillStyle: 'hatch',
  hatchGap: 7,
  color: palette.ink,
  width: 3,
  seed: 51
}
const BRICKS: SketchStyle = {
  fill: '#b8b0a4',
  fillStyle: 'hatch',
  hatchGap: 9,
  color: palette.ink,
  width: 3,
  seed: 52
}
const HOLE: SketchStyle = {
  fill: '#27404f',
  color: palette.ink,
  width: 3,
  seed: 53
}
const SIGN: SketchStyle = {
  fill: '#f3d9a8',
  color: palette.ink,
  width: 2,
  seed: 54
}
const roofPoints = new Float64Array([132, 506, 250, 440, 368, 506])

/** Posts, roof, beam and the dark hole behind the bucket. */
function paintWellBack(ctx: CanvasRenderingContext2D): void {
  WOOD.seed = 55
  sketchLine(ctx, 168, WELL_RIM_Y, 168, BEAM_Y - 8, WOOD)
  WOOD.seed = 56
  sketchLine(ctx, 332, WELL_RIM_Y, 332, BEAM_Y - 8, WOOD)
  WOOD.seed = 57
  sketchLine(ctx, 160, BEAM_Y, 340, BEAM_Y, WOOD)
  sketchPolygon(ctx, roofPoints, ROOF)
  sketchEllipse(ctx, WELL_X, WELL_RIM_Y, 92, 16, HOLE)
  // The crank stand and the rod to the well.
  WOOD.seed = 58
  sketchLine(ctx, CRANK_X, GROUND_Y, CRANK_X, CRANK_Y + 6, WOOD)
  sketchLine(ctx, 340, CRANK_Y, CRANK_X, CRANK_Y, {
    color: palette.inkSoft,
    width: 5,
    seed: 59
  })
  // The hook post for the sieve.
  WOOD.seed = 60
  sketchLine(ctx, HOOK_X - 26, GROUND_Y, HOOK_X - 26, HOOK_Y - 50, WOOD)
  sketchLine(ctx, HOOK_X - 26, HOOK_Y - 46, HOOK_X, HOOK_Y - 46, {
    width: 3,
    seed: 61
  })
  // The washing line, from the hook post to the well.
  sketchPath(ctx, LINE_POINTS, {
    color: palette.inkSoft,
    width: 2,
    smooth: true,
    seed: 66
  })
}

/** The washing line sags between the hook post and the well's left post. */
const LINE_POINTS = new Float64Array([
  HOOK_X - 26,
  HOOK_Y - 48,
  LINE_SLIPPERS_X - 26,
  LINE_SLIPPERS_Y - 22,
  168,
  516
])

/** Front bricks and the sign; drawn after the bucket so it can rise from inside. */
function paintWellFront(ctx: CanvasRenderingContext2D): void {
  sketchRect(ctx, 158, WELL_RIM_Y, 184, GROUND_Y - WELL_RIM_Y, BRICKS)
  sketchEllipse(ctx, WELL_X, WELL_RIM_Y, 92, 16, {
    color: palette.ink,
    width: 4,
    seed: 62
  })
  sketchRect(ctx, 186, 690, 128, 44, SIGN)
  sketchText(ctx, 'Wishing well.', WELL_X, 703, { size: 17, seed: 3 })
  sketchText(ctx, 'No refunds.', WELL_X, 722, { size: 17, seed: 4 })
}

const WHEEL: SketchStyle = {
  color: palette.brown,
  width: 5,
  wobble: 2,
  seed: 63
}

function paintCrankWheel(ctx: CanvasRenderingContext2D): void {
  sketchCircle(ctx, 0, 0, CRANK_RADIUS + 4, WHEEL)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    sketchLine(
      ctx,
      0,
      0,
      Math.cos(a) * CRANK_RADIUS,
      Math.sin(a) * CRANK_RADIUS,
      { color: palette.brown, width: 3, seed: 64 + i }
    )
  }
  sketchCircle(ctx, 0, 0, 7, { fill: palette.ink, width: 2, seed: 70 })
}

const BUCKET: SketchStyle = {
  fill: '#9aa5ad',
  fillStyle: 'hatch',
  hatchGap: 6,
  color: palette.ink,
  width: 3,
  wobble: 1.5,
  seed: 71
}
const bucketPoints = new Float64Array(8)
const ropePoints = new Float64Array(6)
const SIDE_MESH: SketchStyle = {
  fill: 'rgba(120,120,120,0.35)',
  fillStyle: 'hatch',
  hatchGap: 5,
  color: palette.inkSoft,
  width: 1.5,
  wobble: 1,
  seed: 72
}
const SIDE_RIM: SketchStyle = {
  color: '#9a6a3a',
  width: 5,
  wobble: 1.5,
  seed: 73
}
const FROG: SketchStyle = {
  fill: '#5fae52',
  color: palette.ink,
  width: 2.5,
  wobble: 1.5
}
const ARM: SketchStyle = { color: palette.ink, width: 9, passes: 1, wobble: 1 }

/**
 * Draws the well scene: backdrop, well, raised bucket, crank, frog, the sieve on its hook
 * or in your hand, and the hero. Also paints the cam view into the bucket.
 */
export class WellScene {
  readonly layers: CachedLayer[]
  private readonly back: CachedLayer
  private readonly front: CachedLayer
  private readonly wheel: CachedLayer
  private readonly knob = { x: 0, y: 0 }
  private turnsKey = -1
  private turnsText = ''
  private refillSeconds = -1
  private refillText = ''
  private readonly pose: HeroPose = {
    x: HERO_X,
    groundY: GROUND_Y,
    stride: 0,
    speed: 0,
    facing: -1,
    carrying: false,
    water: 0,
    worry: 0,
    despair: false,
    tremble: 0,
    lean: 0,
    fall: 0,
    timeMs: 0
  }
  private state: GameState | null = null

  constructor(
    viewport: Viewport,
    private readonly path: PathScene,
    private readonly pond: LeafPond,
    private readonly sim: Sim
  ) {
    this.back = new CachedLayer(viewport, paintWellBack, {
      x: 40,
      y: 430,
      width: 440,
      height: 350
    })
    this.front = new CachedLayer(viewport, paintWellFront, {
      x: 140,
      y: 640,
      width: 220,
      height: 140
    })
    const r = CRANK_RADIUS + 14
    this.wheel = new CachedLayer(viewport, paintCrankWheel, {
      x: -r,
      y: -r,
      width: r * 2,
      height: r * 2
    })
    this.layers = [this.back, this.front, this.wheel]
  }

  invalidate(): void {
    for (const layer of this.layers) layer.invalidate()
  }

  dispose(): void {
    for (const layer of this.layers) layer.dispose()
  }

  /** True when the cam should show the sieve: holding water, or in hand over the bucket. */
  showsSieve(state: GameState): boolean {
    return state.sieve.inSieve > 0 || (state.well.bucketUp && state.grip.held)
  }

  drawWorld(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeMs: number,
    face: HeroFace
  ): void {
    this.state = state
    const well = state.well
    this.path.drawBackdrop(ctx, -240, 170)
    this.back.draw(ctx)
    const bucketTop = this.bucketTop(state)
    if (bucketTop > BUCKET_UP_Y + 1) this.drawBucket(ctx, state, bucketTop)
    this.front.draw(ctx)
    if (bucketTop <= BUCKET_UP_Y + 1) this.drawBucket(ctx, state, bucketTop)

    const pose = this.pose
    pose.despair = face === 'despair'
    pose.smug = face === 'smug'
    pose.timeMs = timeMs
    pose.worry = state.steady.total
    drawHero(ctx, pose)

    const held = state.grip.held || state.sieve.inSieve > 0
    SIDE_MESH.hatchGap = state.gear.finerMesh ? 3 : 5
    const k = state.gear.biggerSieve ? BIG_AT_WELL : 1
    if (held) this.drawSieveInHand(ctx, state, k)
    else this.drawSieveOnHook(ctx, k)
    if (held && well.dipped && bucketTop <= BUCKET_UP_Y + 1)
      this.drawBucketLip(ctx, bucketTop)

    ctx.save()
    ctx.translate(CRANK_X, CRANK_Y)
    this.wheel.draw(ctx)
    ctx.restore()
    drawLineSlippers(ctx, state, timeMs)
    if (state.kit.wax) {
      const due = !state.bench.open && this.sim.chores.has(REWAX_CHORE.id)
      drawWaxTin(ctx, due, timeMs)
    }
    const knob = crankHandle(well.crankAngle, this.knob)
    sketchLine(ctx, CRANK_X, CRANK_Y, knob.x, knob.y, CRANK_ARM)
    // In winter the handle is frosted white and stiff.
    KNOB.fill = state.season === 'winter' ? '#e7f5ff' : palette.yellow
    sketchCircle(ctx, knob.x, knob.y, 11, KNOB)
    if (!held) {
      // Hands on the crank.
      ARM.seed = 76
      sketchLine(ctx, SHOULDER_X, SHOULDER_Y, knob.x, knob.y, ARM)
    }
    if (well.frog !== 'none') {
      const fx = well.frog === 'dragging' ? well.frogX : knob.x
      const fy = well.frog === 'dragging' ? well.frogY : knob.y - 12
      drawFrog(ctx, fx, fy, timeMs)
    }
  }

  /** Paints the round cam: looking down into the raised bucket, or into the well. */
  readonly drawCam = (ctx: CanvasRenderingContext2D): void => {
    const state = this.state
    if (!state) return
    const well = state.well
    if (well.bucketUp) {
      ctx.fillStyle = '#7d878e'
      ctx.fillRect(CAM_X - 130, CAM_Y - 130, 260, 260)
      ctx.fillStyle = well.scoopsLeft > 0 ? '#5aa9e6' : '#556066'
      ctx.beginPath()
      ctx.arc(CAM_X, CAM_Y, 104, 0, Math.PI * 2)
      ctx.fill()
      sketchCircle(ctx, CAM_X, CAM_Y, 106, BUCKET_RING)
      // A dipped sieve wears the leaves on its mesh; the renderer draws them over it.
      if (!well.dipped) this.pond.drawFloating(ctx, false)
      return
    }
    ctx.fillStyle = '#b8b0a4'
    ctx.fillRect(CAM_X - 130, CAM_Y - 130, 260, 260)
    ctx.fillStyle = '#1d2f3a'
    ctx.beginPath()
    ctx.arc(CAM_X, CAM_Y, 92, 0, Math.PI * 2)
    ctx.fill()
    sketchCircle(ctx, CAM_X, CAM_Y, 94, WELL_RING)
    const refill = state.waits.refill
    if (refill) {
      sketchText(ctx, 'Refilling', CAM_X, CAM_Y - 22, CAM_LABEL)
      sketchText(ctx, this.refillLabel(refill), CAM_X, CAM_Y + 26, CAM_CLOCK)
    } else {
      const label =
        well.frog !== 'none'
          ? 'Frog!'
          : this.turnsLabel(
              well.crankTurns,
              crankNeeded(state.season === 'winter')
            )
      sketchText(ctx, label, CAM_X, CAM_Y, CAM_LABEL)
    }
    // Leaves float on the water down the well too, and come up with the bucket.
    this.pond.drawFloating(ctx, false)
  }

  /** The refill's countdown, such as "0:42", built once a second. */
  private refillLabel(timer: RealTimer): string {
    const seconds = Math.ceil(timeLeftMs(timer, this.sim.now()) / 1000)
    if (seconds !== this.refillSeconds) {
      this.refillSeconds = seconds
      this.refillText = formatClock(seconds * 1000)
    }
    return this.refillText
  }

  /** "3 / 5", built only when the count changes. */
  private turnsLabel(turns: number, needed: number): string {
    const key = turns * 100 + needed
    if (key !== this.turnsKey) {
      this.turnsKey = key
      this.turnsText = `${turns} / ${needed}`
    }
    return this.turnsText
  }

  private bucketTop(state: GameState): number {
    const well = state.well
    if (well.bucketUp) return BUCKET_UP_Y
    const needed = crankNeeded(state.season === 'winter')
    const risen = (well.crankTurns + well.crankProgress) / needed
    return BUCKET_LOW_Y - Math.min(1, risen) * (BUCKET_LOW_Y - BUCKET_UP_Y)
  }

  private drawBucket(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    top: number
  ): void {
    const well = state.well
    ropePoints[0] = WELL_X
    ropePoints[1] = BEAM_Y
    ropePoints[2] = WELL_X + 3
    ropePoints[3] = (BEAM_Y + top) / 2
    ropePoints[4] = WELL_X
    ropePoints[5] = top - 22
    sketchPath(ctx, ropePoints, ROPE)
    sketchEllipse(ctx, WELL_X, top - 10, BUCKET_TOP_HALF - 6, 14, BUCKET_BACK)
    bucketPoints[0] = WELL_X - BUCKET_TOP_HALF
    bucketPoints[1] = top
    bucketPoints[2] = WELL_X + BUCKET_TOP_HALF
    bucketPoints[3] = top
    bucketPoints[4] = WELL_X + BUCKET_BOTTOM_HALF
    bucketPoints[5] = top + BUCKET_HEIGHT
    bucketPoints[6] = WELL_X - BUCKET_BOTTOM_HALF
    bucketPoints[7] = top + BUCKET_HEIGHT
    sketchPolygon(ctx, bucketPoints, BUCKET)
    if (well.bucketUp && well.scoopsLeft > 0) {
      const water = waterLineY(well.scoopsLeft)
      ctx.fillStyle = 'rgba(116, 192, 252, 0.9)'
      ctx.beginPath()
      ctx.ellipse(WELL_X, water, BUCKET_TOP_HALF - 4, 7, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** The bucket's front rim over a dipped sieve, so it reads as inside the bucket. */
  private drawBucketLip(ctx: CanvasRenderingContext2D, top: number): void {
    sketchLine(
      ctx,
      WELL_X - BUCKET_TOP_HALF,
      top,
      WELL_X + BUCKET_TOP_HALF,
      top,
      BUCKET_LIP
    )
  }

  /** The sieve in your hands over the bucket, `k` times its usual size. */
  private drawSieveInHand(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    k: number
  ): void {
    const x = WELL_X + state.grip.offsetX * 0.6
    const y = state.well.sieveY
    const handleX = x + 88 * k
    ARM.seed = 81
    sketchLine(ctx, SHOULDER_X, SHOULDER_Y, handleX, y, ARM)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(k, k)
    ctx.translate(-x, -y)
    sketchLine(ctx, x + 40, y, x + 88, y, SIEVE_HANDLE)
    SIDE_MESH.seed = 72
    sketchEllipse(ctx, x, y + 4, 40, 9, SIDE_MESH)
    const fill = state.sieve.inSieve / (state.capacityMl || 1)
    if (fill > 0.01) {
      ctx.fillStyle = 'rgba(116, 192, 252, 0.85)'
      ctx.beginPath()
      ctx.ellipse(x, y + 1, 36 * Math.sqrt(fill), 6, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    SIDE_RIM.seed = 73
    sketchEllipse(ctx, x, y, 42, 8, SIDE_RIM)
    ctx.restore()
  }

  /** The sieve hanging on its hook, `k` times its usual size. */
  private drawSieveOnHook(ctx: CanvasRenderingContext2D, k: number): void {
    const r = 34 * k
    const cy = HOOK_Y - 40 + r
    sketchLine(ctx, HOOK_X, HOOK_Y - 46, HOOK_X, cy - r, HOOK_STRING)
    SIDE_MESH.seed = 84
    sketchCircle(ctx, HOOK_X, cy, r - 2, SIDE_MESH)
    SIDE_RIM.seed = 85
    sketchCircle(ctx, HOOK_X, cy, r, SIDE_RIM)
  }
}

// Styles drawn every frame at the well, hoisted so drawing allocates nothing.
const CRANK_ARM: SketchStyle = { color: palette.brown, width: 6, seed: 74 }
/** Its fill turns frosty in winter. */
const KNOB: SketchStyle = { fill: palette.yellow, width: 2.5, seed: 75 }
const BUCKET_RING: SketchStyle = { width: 3, seed: 77 }
const WELL_RING: SketchStyle = { width: 3, seed: 78 }
const CAM_LABEL: SketchTextStyle = {
  font: 'marker',
  size: 40,
  color: palette.paper,
  tilt: 0.05
}
const CAM_CLOCK: SketchTextStyle = {
  font: 'marker',
  size: 34,
  color: palette.yellow,
  tilt: -0.04
}
const ROPE: SketchStyle & { smooth: boolean } = {
  color: palette.brown,
  width: 3,
  smooth: true
}
const BUCKET_BACK: SketchStyle = { color: palette.inkSoft, width: 2, seed: 79 }
const BUCKET_LIP: SketchStyle = { width: 4, seed: 80 }
const SIEVE_HANDLE: SketchStyle = { color: '#c08a55', width: 7, seed: 82 }
const HOOK_STRING: SketchStyle = { width: 3, seed: 83 }
const HANG_TEXT: SketchTextStyle = { size: 20, color: palette.inkSoft }
/** Each slipper's peg has its own seed. */
const PEG: SketchStyle = { color: palette.brown, width: 4, seed: 690 }
const WAX_TEXT: SketchTextStyle = { font: 'marker', size: 14 }
const DASH = [7, 6]
const NO_DASH: number[] = []

const LINE_SLIPPER: SketchStyle = {
  fill: '#a9bccb',
  color: palette.ink,
  width: 2,
  wobble: 1
}
const TIN: SketchStyle = {
  fill: '#c9cfd4',
  color: palette.ink,
  width: 2.5,
  wobble: 1
}

/**
 * The washing line: soaked slippers pegged up while they dry, dripping less as they go,
 * or a dashed spot that pulses while soaked slippers wait to go up.
 */
function drawLineSlippers(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeMs: number
): void {
  const x = LINE_SLIPPERS_X
  const y = LINE_SLIPPERS_Y
  if (state.kit.slippers === 'soaked' && state.scene === 'well') {
    pulseRing(ctx, x, y, 28, timeMs)
    sketchText(ctx, 'Hang', x, y - 2, HANG_TEXT)
    return
  }
  const timer = state.waits.slippers
  if (state.kit.slippers !== 'drying' || !timer) return
  const dry = timerProgress(timer)
  for (let dx = -12; dx <= 12; dx += 24) {
    const sx = x + dx
    // Pegged by the heel, toe down, ears flopping.
    LINE_SLIPPER.fill = dry > 0.6 ? palette.yellow : '#a9bccb'
    LINE_SLIPPER.seed = 700 + dx
    sketchEllipse(ctx, sx, y + 2, 8, 17, LINE_SLIPPER)
    sketchEllipse(ctx, sx - 5, y + 18, 3, 8, LINE_SLIPPER)
    sketchEllipse(ctx, sx + 5, y + 18, 3, 8, LINE_SLIPPER)
    PEG.seed = 702 + dx
    sketchLine(ctx, sx, y - 18, sx, y - 9, PEG)
    if (dry > 0.9) continue
    // Drips slow down as they dry.
    const drop = (timeMs / (500 + dry * 1500) + dx) % 1
    ctx.fillStyle = palette.water
    ctx.globalAlpha = 1 - dry
    ctx.beginPath()
    ctx.arc(sx, y + 22 + drop * 60, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

/** The wax tin by the hook post; it bobs and pulses while the sieve wants rewaxing. */
function drawWaxTin(
  ctx: CanvasRenderingContext2D,
  due: boolean,
  timeMs: number
): void {
  const bob = due ? Math.abs(Math.sin(timeMs / 200)) * -5 : 0
  const x = WAX_TIN_X
  const y = WAX_TIN_Y + bob
  TIN.seed = 710
  sketchRect(ctx, x - 20, y - 12, 40, 24, TIN)
  TIN.seed = 711
  sketchEllipse(ctx, x, y - 12, 20, 6, TIN)
  sketchText(ctx, 'WAX', x, y + 3, WAX_TEXT)
  if (due) pulseRing(ctx, x, WAX_TIN_Y - 4, 34, timeMs)
}

/** A dashed red ring that pulses, round something you should tap. */
function pulseRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  timeMs: number
): void {
  ctx.strokeStyle = palette.red
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(timeMs / 180))
  ctx.setLineDash(DASH)
  ctx.beginPath()
  ctx.arc(x, y, r + 3 * Math.sin(timeMs / 180), 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash(NO_DASH)
  ctx.globalAlpha = 1
}

function drawFrog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeMs: number
): void {
  const hop = Math.abs(Math.sin(timeMs / 260)) * 3
  FROG.seed = 90
  sketchEllipse(ctx, x, y - hop, 20, 14, FROG)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x - 8, y - hop - 13, 6, 0, Math.PI * 2)
  ctx.moveTo(x + 14, y - hop - 13)
  ctx.arc(x + 8, y - hop - 13, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = palette.ink
  ctx.beginPath()
  ctx.arc(x - 8, y - hop - 13, 2.5, 0, Math.PI * 2)
  ctx.arc(x + 8, y - hop - 13, 2.5, 0, Math.PI * 2)
  ctx.fill()
}
