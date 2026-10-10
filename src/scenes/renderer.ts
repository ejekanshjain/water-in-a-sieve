import { drainCaption, litres } from '../game/captions'
import type { RainGag } from '../game/rain'
import { tiltLimits } from '../game/sieve'
import { isCutscene } from '../game/story'
import { nextBumpAhead } from '../game/path'
import type { Sim } from '../game/sim'
import {
  CAM_OFFSET_SCALE,
  CAM_X,
  CAM_Y,
  GROUND_Y,
  HERO_X_OUT,
  NEAR_MISS_SNAP_MS,
  PATH_METRES,
  POUR_SAFE_LPS,
  RAIN_MS,
  RESULT_MS,
  SCOOPS_PER_FILL,
  WARN_AHEAD_M,
  WELL_X
} from '../game/tuning'
import type { InputMode, Season } from '../game/types'
import {
  devFlags,
  loadSketchFonts,
  palette,
  settings,
  sfx,
  sketchText,
  toast,
  vibrate,
  type LoopHandle,
  type SketchTextStyle,
  type Viewport
} from '../shared'
import { outfit, sideSievePosition, type HeroFace } from './art/hero'
import { LeafArt } from './art/leaf'
import { drawBubbleLevel, SIEVE_RADIUS } from './art/sieve'
import { BenchView } from './bench'
import { SieveCam } from './cam'
import { CUES, Cutscenes, type Cue } from './cutscenes'
import { drawDebugMarkers, drawDebugPanel } from './debug'
import { STARE_MS, TAPS_ON_MS } from './ending'
import { FailFilm, HOUSE_BAND, ROOM_BAND } from './film'
import { Caption, Kind, Particles, Shake } from './fx'
import { EventView } from './events'
import { catSpot, HouseScene, ROOM_FOR } from './house'
import { LeafPond } from './leaves'
import { Knocks, Tumbles } from './physics'
import { layout } from './layout'
import type { PhoneTilt } from './motion'
import { PathScene } from './path'
import { perf } from './perf'
import { KICK, SHED_WALL_X } from './progress'
import { WellScene } from './well'

/** One drip particle per this many mL dripped. */
const ML_PER_DRIP = 3
const DRIP_SFX_GAP_MS = 1000 / 6
const SLOSH_SFX_GAP_MS = 1000 / 3
/** Scene changes whip-pan over this long. */
const WHIP_MS = 250
/** A No-Drip Trip keeps you smug for this long: the whole walk back. */
const SMUG_MS = 7000
/** The cam sieve wobbles this long after a jolt: wide and flat, then tall, then still. */
const SQUASH_MS = 320
/** How far a jolt squashes the cam sieve at full strength: 10%. */
const SQUASH_SCALE = 0.1
/** Rain swells in and fades out over this long. */
const RAIN_FADE_MS = 1500

// Text styles drawn every frame, hoisted so drawing allocates nothing.
const SKIP_TEXT: SketchTextStyle = {
  size: 24,
  color: palette.inkSoft,
  alpha: 0.85
}
const HINT_TEXT: SketchTextStyle = {
  size: 26,
  outline: palette.paper,
  maxWidth: 500
}
const PAUSED_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 56,
  tilt: 0.05,
  outline: palette.paper
}
/** Its alpha pulses, so it's set per frame. */
const HOLD_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 44,
  outline: palette.paper,
  alpha: 1
}
/** The trip report's first line; its seed follows the trip. */
const REPORT_HEAD: SketchTextStyle = {
  font: 'marker',
  size: 40,
  tilt: 0.05,
  seed: 1,
  maxWidth: 220
}
const REPORT_TAIL: SketchTextStyle = { size: 26, maxWidth: 220 }

/**
 * Draws a frame: the current scene with shake, the sieve cam and ring, particles,
 * captions and overlays. It also turns sim events into effects and sounds. It only reads
 * game state.
 */
export class Renderer {
  private readonly path: PathScene
  private readonly well: WellScene
  private readonly house: HouseScene
  private readonly sieveCam: SieveCam
  private readonly cutscenes: Cutscenes
  private readonly bench: BenchView
  private readonly leafArt: LeafArt
  /** The well water's floating leaves; the well input drags them. */
  readonly pond: LeafPond
  /** Films the last few seconds for fail replays, and snaps stills for share cards. */
  readonly film: FailFilm
  private windLoop: LoopHandle | null = null
  private gurgleLoop: LoopHandle | null = null
  private rainLoop: LoopHandle | null = null
  private lastLapAt = -1e9
  private readonly knocks = new Knocks()
  private lastPuffAt = -1e9
  private readonly events: EventView
  /** Cutscene time already cued, so each cue fires once. */
  private cuedMs = -1
  private pourLoop: LoopHandle | null = null
  private lastSplashAt = -1e9
  private readonly tumbles = new Tumbles()
  private fallMs = 0
  private fallTotal = 1
  private lastTickAt = -1e9
  /** Paint every cached layer once up front, so scene changes never hitch. */
  private warmPending = true
  private readonly stopResize: () => void
  private readonly world = new Particles()
  private readonly cam = new Particles()
  private readonly shake = new Shake()
  private readonly caption = new Caption()
  private readonly side = { x: 0, y: 0 }
  private lastTimeMs = -1
  private flash = 0
  private despairMs = 0
  private smugMs = 0
  private squashMs = 0
  private squashAmp = 0
  private crankQuarter = 0
  /** The ending's bathtub still was taken, so the ending card has its picture. */
  private endingSnapped = false
  private whipMs = 0
  private whipDir = 1
  private lastDripSfx = -1e9
  private threadMisses = 0
  private swings = 0
  private lastSloshSfx = -1e9
  /** The trip report drawn in the cam, split into its two lines. */
  private report = ''
  private reportHead = ''
  private reportTail = ''

  constructor(
    private readonly viewport: Viewport,
    private readonly sim: Sim,
    private readonly inputMode: () => InputMode,
    private readonly tilt: PhoneTilt,
    /** Before the start tap only the world shows, as a backdrop for the title. */
    private readonly started: () => boolean
  ) {
    this.path = new PathScene(viewport)
    this.leafArt = new LeafArt(viewport)
    this.pond = new LeafPond(sim, this.leafArt)
    this.well = new WellScene(viewport, this.path, this.pond, sim)
    this.events = new EventView(sim, this.leafArt, {
      caption: this.caption,
      cam: this.cam,
      shake: this.shake,
      fall: () => this.fallOver()
    })
    this.house = new HouseScene(viewport, this.path)
    this.sieveCam = new SieveCam(viewport)
    this.cutscenes = new Cutscenes(viewport, this.house, this.path)
    this.bench = new BenchView(viewport)
    this.film = new FailFilm(viewport)
    // Text in cached layers needs the fonts, so repaint once they load.
    void loadSketchFonts().then(() => {
      for (const layer of this.path.layers) layer.invalidate()
      this.well.invalidate()
      this.house.invalidate()
      this.sieveCam.invalidate()
      this.cutscenes.invalidate()
      for (const layer of this.bench.layers) layer.invalidate()
      for (const layer of this.leafArt.layers) layer.invalidate()
      this.warmPending = true
    })
    // A new scale repaints every layer; do it all at once, not scene by scene.
    this.stopResize = viewport.onResize(() => {
      this.warmPending = true
    })
  }

  dispose(): void {
    this.pourLoop?.stop(0)
    this.windLoop?.stop(0)
    this.gurgleLoop?.stop(0)
    this.rainLoop?.stop(0)
    this.knocks.dispose()
    this.film.dispose()
    this.stopResize()
    this.pond.dispose()
    this.leafArt.dispose()
    this.tumbles.dispose()
    this.path.dispose()
    this.well.dispose()
    this.house.dispose()
    this.sieveCam.dispose()
    this.cutscenes.dispose()
    for (const layer of this.bench.layers) layer.dispose()
  }

  render(timeMs: number): void {
    const frameStart = import.meta.env.DEV ? performance.now() : 0
    const ctx = this.viewport.begin(palette.paper)
    const dt =
      this.lastTimeMs < 0
        ? 0
        : Math.min(100, Math.max(0, timeMs - this.lastTimeMs))
    this.lastTimeMs = timeMs
    this.consumeEvents(timeMs)
    this.playCues(timeMs)
    this.spawnDrips(timeMs)
    this.pourEffects(timeMs)
    this.blowEffects(timeMs)
    this.catSounds(timeMs)
    this.events.sounds(timeMs)
    this.world.update(dt)
    this.cam.update(dt)
    this.shake.update(dt)
    this.caption.update(dt)
    this.flash = Math.max(0, this.flash - dt / 400)
    this.despairMs = Math.max(0, this.despairMs - dt)
    this.smugMs = Math.max(0, this.smugMs - dt)
    this.squashMs = Math.max(0, this.squashMs - dt)
    this.whipMs = Math.max(0, this.whipMs - dt)
    this.tumbles.update(dt)
    this.knocks.update(dt)
    this.fallMs = Math.max(0, this.fallMs - dt)
    this.path.fall = fallCurve(
      1 - this.fallMs / this.fallTotal,
      this.fallMs > 0
    )
    const mole = this.path.mole
    if (mole) {
      mole.t += dt / 1500
      if (mole.t >= 1) this.path.mole = null
    }
    this.bumpTicks(timeMs)
    this.crankTicks()
    this.sieveCam.squash = this.squash()

    const state = this.sim.state
    dress(state)
    if (state.scene === 'well' && !state.paused) this.pond.update(dt)
    // A new season repaints the path tiles; do it now, not mid-walk.
    if (this.path.setSeason(state.season)) this.warmPending = true
    if (this.warmPending) this.warm(ctx)
    const face: HeroFace =
      this.despairMs > 0 ? 'despair' : this.smugMs > 0 ? 'smug' : 'plain'
    const whip = this.whipMs / WHIP_MS
    ctx.save()
    ctx.translate(
      this.shake.offset(timeMs, 0) + this.whipDir * whip * whip * 540,
      this.shake.offset(timeMs, 1)
    )
    if (state.scene === 'cutscene') this.cutscenes.draw(ctx, state, timeMs)
    else if (state.scene === 'well')
      this.well.drawWorld(ctx, state, timeMs, face)
    else if (state.scene === 'house')
      this.house.drawWorld(ctx, state, timeMs, face)
    else this.path.drawWorld(ctx, state, timeMs, face)
    if (state.scene === 'path')
      this.events.drawSide(ctx, state, HERO_X_OUT, timeMs)
    else if (state.scene === 'house')
      this.events.drawSide(ctx, state, this.house.heroX(state), timeMs)
    this.tumbles.draw(ctx)
    this.knocks.draw(ctx)
    this.world.draw(ctx)
    if (import.meta.env.DEV && devFlags.debug)
      drawDebugMarkers(ctx, state, this.path)
    ctx.restore()
    if (whip > 0) this.drawWhipLines(ctx, whip)
    if (!this.started()) {
      if (import.meta.env.DEV) perf.record(performance.now() - frameStart)
      return
    }

    if (state.scene === 'cutscene') {
      // No sieve yet: the cold open is all story.
    } else if (state.bench.open) {
      this.bench.draw(ctx, state, this.sim.eyeX(), timeMs)
    } else if (state.scene === 'well') {
      this.sieveCam.draw(
        ctx,
        state,
        timeMs,
        this.flash,
        0,
        this.well.drawCam,
        this.well.showsSieve(state)
      )
      this.drawClingingLeaves(ctx)
      this.pond.drawHeld(ctx, timeMs)
    } else if (state.scene === 'house') {
      this.sieveCam.draw(
        ctx,
        state,
        timeMs,
        this.flash,
        PATH_METRES,
        this.house.drawCam,
        state.phase !== 'visit'
      )
      this.events.drawCam(ctx, timeMs)
      if (state.phase === 'pour') this.house.drawGauge(ctx, state)
    } else {
      this.path.setCamScroll(state.walker.distance)
      const back = state.scene === 'walkBack'
      this.sieveCam.draw(
        ctx,
        state,
        timeMs,
        this.flash,
        state.walker.distance,
        back ? this.drawReport : this.path.drawCamGround,
        !back
      )
      this.events.drawCam(ctx, timeMs)
    }
    this.cam.draw(ctx)
    if (this.inputMode() === 'motion' && state.scene !== 'cutscene') {
      const limits = tiltLimits(settings.get().assist)
      drawBubbleLevel(
        ctx,
        CAM_X + 160,
        CAM_Y + 112,
        this.tilt.tiltX,
        this.tilt.tiltY,
        limits.dribble,
        limits.tip
      )
    }
    this.drawOverlays(ctx, timeMs)
    // Nothing moves behind a pause or the ending screen, so neither is worth filming.
    this.film.record(timeMs, state.paused || state.ended)
    if (import.meta.env.DEV) perf.record(performance.now() - frameStart)
  }

  /** Empty walks show the trip report in the cam, over the scrolling ground. */
  private readonly drawReport = (ctx: CanvasRenderingContext2D): void => {
    this.path.drawCamGround(ctx)
    ctx.fillStyle = 'rgba(253, 246, 227, 0.8)'
    ctx.fillRect(CAM_X - 130, CAM_Y - 130, 260, 260)
    const state = this.sim.state
    const report =
      state.tripReport ||
      (state.walker.dir > 0 ? 'Off to the house.' : 'Back to the well.')
    // Split once per report, not once per frame.
    if (report !== this.report) {
      this.report = report
      const split = report.indexOf('. ')
      this.reportHead = split > 0 ? report.slice(0, split + 1) : report
      this.reportTail = split > 0 ? report.slice(split + 2) : ''
    }
    REPORT_HEAD.seed = state.trip
    sketchText(ctx, this.reportHead, CAM_X, CAM_Y - 24, REPORT_HEAD)
    if (this.reportTail)
      sketchText(ctx, this.reportTail, CAM_X, CAM_Y + 30, REPORT_TAIL)
  }

  /** Leaves in the bucket cling to a dipped sieve's mesh, over the water. */
  private drawClingingLeaves(ctx: CanvasRenderingContext2D): void {
    const state = this.sim.state
    if (!state.well.dipped || state.well.leaves.length === 0) return
    ctx.save()
    ctx.beginPath()
    ctx.arc(CAM_X, CAM_Y, 118, 0, Math.PI * 2)
    ctx.clip()
    this.pond.drawFloating(ctx, true)
    ctx.restore()
  }

  /** You go over while carrying: legs up, and the sieve flies out of your hands. */
  private fallOver(): void {
    this.fallTotal = 900
    this.fallMs = this.fallTotal
    this.shake.kick(5, 250)
    sfx.play('whoosh')
    sfx.play('thud', { volume: 0.8 })
    const pos = this.sievePosition()
    this.tumbles.throwSieve(pos.x, pos.y, 260, -520)
  }

  /** Spring rain over the tub: each one a bigger joke than the last. */
  private reactRain(stage: 'start' | 'stopped' | 'gone', gag: RainGag): void {
    if (stage === 'start') {
      this.caption.queue(RAIN_LINES[gag], 1800)
      sfx.play('rumble', { volume: 0.4, pitch: 0.7 })
    } else if (stage === 'stopped' && gag === 'scoop') {
      this.caption.queue('Through the sieve. Obviously.', 1500)
    } else if (stage === 'gone') {
      this.caption.queue(
        gag === 'umbrella'
          ? 'Bone dry. Thanks, umbrella.'
          : 'It was never yours.',
        1800
      )
    }
  }

  /** In the house: the cat lapping at your water, and the tub gurgling down its plughole. */
  private catSounds(timeMs: number): void {
    const state = this.sim.state
    const house = state.scene === 'house'
    if (
      house &&
      state.cat.mood === 'drinking' &&
      timeMs - this.lastLapAt > 260
    ) {
      this.lastLapAt = timeMs
      sfx.play('drip', { pitch: 1.4, volume: 0.35 })
    }
    const rain = state.rain
    const raining = house && rain.stage === 'falling'
    if (raining) {
      // It swells in with the clouds and eases off as they pass.
      const swell = Math.min(
        1,
        rain.ms / RAIN_FADE_MS,
        (RAIN_MS - rain.ms) / RAIN_FADE_MS
      )
      this.rainLoop ??= sfx.loop('rain', { volume: 0.6 })
      this.rainLoop.setVolume(0.6 * (0.25 + 0.75 * Math.max(0, swell)))
    } else if (this.rainLoop) {
      this.rainLoop.stop()
      this.rainLoop = null
    }
    const tubMl = state.containers[2]?.inContainer ?? 0
    const gurgling = house && state.cat.plugOut && tubMl > 0
    if (gurgling) {
      this.gurgleLoop ??= sfx.loop('pour', { pitch: 0.5, volume: 0.4 })
    } else if (this.gurgleLoop) {
      this.gurgleLoop.stop()
      this.gurgleLoop = null
    }
  }

  /** Blowing: a wind sound, puffs from your mouth and ripples across the water. */
  private blowEffects(timeMs: number): void {
    const state = this.sim.state
    if (!state.blowing) {
      this.windLoop?.stop()
      this.windLoop = null
      return
    }
    this.windLoop ??= sfx.loop('wind', { volume: 0.35, pitch: 1.4 })
    if (timeMs - this.lastPuffAt < 90) return
    this.lastPuffAt = timeMs
    const heroX = state.scene === 'house' ? this.house.heroX(state) : HERO_X_OUT
    this.world.spawn(
      Kind.Ripple,
      heroX + 40 + Math.random() * 30,
      GROUND_Y - 190 + Math.random() * 30,
      0,
      0,
      350
    )
    this.cam.spawn(
      Kind.Ripple,
      CAM_X +
        state.grip.offsetX * CAM_OFFSET_SCALE +
        (Math.random() - 0.5) * 80,
      CAM_Y +
        state.grip.offsetY * CAM_OFFSET_SCALE +
        (Math.random() - 0.5) * 80,
      0,
      0,
      450
    )
  }

  private drawWhipLines(ctx: CanvasRenderingContext2D, whip: number): void {
    const view = this.viewport.view
    ctx.strokeStyle = palette.inkSoft
    ctx.globalAlpha = whip * 0.6
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let i = 0; i < 9; i++) {
      const y = 500 + i * 34
      const x = view.x + ((i * 173) % view.width)
      ctx.moveTo(x, y)
      ctx.lineTo(x + 180, y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  private drawOverlays(ctx: CanvasRenderingContext2D, timeMs: number): void {
    const state = this.sim.state
    const mode = this.inputMode()
    const cutscene = state.scene === 'cutscene'
    if (cutscene) this.caption.draw(ctx, CAM_X, 230)
    // Above the bench card while you mend, under the sieve cam otherwise.
    else if (this.caption.visible)
      this.caption.draw(ctx, CAM_X, state.bench.open ? 196 : 505)
    // Share stills keep the caption, but not the hint or the skip line.
    this.film.snapIfDue(timeMs)
    if (cutscene) {
      const skip = mode === 'mouse' ? 'Click to skip' : 'Tap to skip'
      if (!state.ended)
        sketchText(ctx, this.sim.hint(mode) ?? skip, CAM_X, 900, SKIP_TEXT)
    } else if (!this.caption.visible && layout.get().mode === 'bands') {
      // Phones show the hint on the canvas; desktop shows it in the left column.
      const hint = this.sim.hint(mode)
      if (hint)
        sketchText(ctx, hint, CAM_X, state.bench.open ? 752 : 500, HINT_TEXT)
    }
    if (state.paused) {
      const view = this.viewport.view
      ctx.fillStyle = 'rgba(253, 246, 227, 0.55)'
      ctx.fillRect(view.x, view.y, view.width, view.height)
      sketchText(ctx, 'Paused', CAM_X, CAM_Y, PAUSED_TEXT)
    } else if (state.holdStillMs > 0) {
      HOLD_TEXT.alpha = 0.6 + 0.4 * Math.abs(Math.sin(timeMs / 150))
      sketchText(ctx, 'Hold still…', CAM_X, CAM_Y, HOLD_TEXT)
    }
    if (import.meta.env.DEV && devFlags.debug)
      drawDebugPanel(ctx, state, mode, this.tilt)
  }

  private consumeEvents(timeMs: number): void {
    const events = this.sim.events
    const state = this.sim.state
    for (const event of events) {
      switch (event.type) {
        case 'drain': {
          const stats = state.stats
          const atWell = event.scene === 'well' && event.cause === 'jolt'
          const line = atWell
            ? 'Slowly.'
            : drainCaption(event.cause, {
                count: stats.drainsByCause[event.cause] - 1,
                lostMl: stats.lostByCause[event.cause],
                pathMetres: event.scene === 'path' ? event.distance : null
              })
          this.caption.show(line)
          this.film.noteDrain(event.record, line, this.sim.lostMl(), timeMs)
          this.smugMs = 0
          this.kickSquash(1)
          this.shake.kick(12, 300)
          this.flash = 1
          this.despairMs = RESULT_MS
          this.splash(event.ml / (state.capacityMl || 1))
          sfx.play('splash')
          if (event.big) {
            sfx.play('fail')
            vibrate([40, 30, 80])
          } else {
            vibrate(30)
          }
          break
        }
        case 'poured':
          if (event.dumped) {
            this.caption.show('Dumped it.')
            this.shake.kick(10, 260)
            this.splash(1)
            sfx.play('splash')
          } else {
            this.caption.show(
              event.bonus > 0
                ? `No-Drip Trip! +${event.coins + event.bonus}`
                : `Delivered ${litres(event.ml)}`
            )
          }
          if (event.coins > 0) sfx.play('coin')
          if (event.bonus > 0) {
            sfx.play('ding')
            // A No-Drip Trip earns a smug grin all the way home.
            this.smugMs = SMUG_MS
          }
          break
        case 'noDripCracked':
          if (!this.caption.visible) this.caption.show('Drip. No bonus.', 1100)
          sfx.play('pop', { pitch: 0.6, volume: 0.6 })
          break
        case 'containerDone':
          // The bucket and the sink get a cutscene once the result has shown.
          if (event.index >= 2) {
            this.caption.queue(`${event.name}: done.`, 2400)
            sfx.play('ding')
          }
          sfx.play('coin')
          break
        case 'season':
          if (!event.quiet) {
            this.caption.queue(SEASON_LINES[event.season], 1800)
            sfx.play('wind', { volume: 0.5 })
          }
          break
        case 'hole':
          if (event.cause === 'dev') break
          this.caption.show('Snag. A hole.', 1300)
          this.shake.kick(4, 200)
          sfx.play('pop', { pitch: 0.6 })
          sfx.play('whoosh', { pitch: 1.6, volume: 0.4 })
          break
        case 'bench':
          if (event.open) {
            this.caption.show(
              event.mode === 'wax'
                ? 'Wax on. Rub it in.'
                : event.holes === 1
                  ? 'One hole. Sew it shut.'
                  : `${event.holes} holes. Sew them shut.`,
              1400
            )
            sfx.play('thud', { volume: 0.5, pitch: 0.8 })
          }
          break
        case 'waxRub':
          sfx.play('scrub', { volume: 0.5, pitch: 1.1 + event.progress * 0.4 })
          break
        case 'waxed':
          this.caption.show('Waxed. So shiny.', 1300)
          sfx.play('ding', { pitch: 1.4 })
          break
        case 'waxWorn':
          this.caption.queue('Wax: worn off.', 1500)
          sfx.play('squish', { pitch: 0.6, volume: 0.6 })
          break
        case 'slippersSoaked':
          this.caption.queue('Soggy slippers.', 1100)
          sfx.play('squish', { pitch: 0.8 })
          break
        case 'slippersHung':
          this.caption.show('Hung up. Barefoot now.', 1300)
          sfx.play('pop', { pitch: 1.2 })
          break
        case 'slippersDry':
          this.caption.queue('Slippers: dry. Back on.', 1300)
          sfx.play('ding', { pitch: 1.1, volume: 0.7 })
          break
        case 'swing':
          sfx.play('whoosh', { pitch: 1.5, volume: 0.8 })
          this.shake.kick(3, 120)
          this.kickSquash(0.8)
          if (!event.target) this.caption.show(swingMiss(this.swings++), 800)
          break
        case 'wish':
          if (event.frog) sfx.play('pop', { pitch: 1.6 })
          break
        case 'stoneOut':
          this.caption.show('Stone out. Drag it in.', 1300)
          sfx.play('thud', { volume: 0.5, pitch: 0.7 })
          break
        case 'stoneLaid':
          this.caption.show(
            event.left === 0
              ? 'Last stone. All paved.'
              : event.flattened > 0
                ? `Bump buried. ${event.left} to go.`
                : `Laid. ${event.left} to go.`,
            1400
          )
          // Burying a bump lands harder.
          this.shake.kick(event.flattened > 0 ? 7 : 4, 180)
          sfx.play('thud', { pitch: 0.6 })
          sfx.play('ding', { pitch: event.left > 0 ? 1.2 : 0.9, volume: 0.6 })
          break
        case 'upgrade':
        case 'treats':
        case 'hat':
          break
        case 'thread':
          if (event.hit) {
            this.caption.show('Threaded!', 900)
            sfx.play('pop', { pitch: 1.5 })
          } else {
            this.caption.show(threadMiss(this.threadMisses++), 1100)
            this.shake.kick(3, 160)
            sfx.play('boing', { volume: 0.5 })
          }
          break
        case 'stitch':
          if (event.result === 'unpick') {
            this.caption.show('Wrong dot. Unpicked.', 1100)
            sfx.play('squish', { pitch: 1.3, volume: 0.6 })
          } else if (event.sewn) {
            this.caption.show('Sewn.', 800)
            sfx.play('ding', { pitch: 1.2, volume: 0.7 })
          } else {
            sfx.play('pop', { pitch: 0.9 + Math.random() * 0.3, volume: 0.6 })
          }
          break
        case 'glue':
          this.caption.show('Glued. Now it dries.', 1300)
          sfx.play('squish')
          break
        case 'glueDone':
          this.caption.queue("The glue's dry.", 1200)
          sfx.play('ding')
          break
        case 'wipeOpen':
          this.caption.show(
            event.kind === 'ice'
              ? 'Scrape it off.'
              : event.kind === 'leaves'
                ? 'Sweep it up.'
                : 'Mop it up.',
            1000
          )
          break
        case 'rub':
          sfx.play('scrub', { volume: 0.5, pitch: 0.9 + event.progress * 0.3 })
          break
        case 'wiped':
          this.caption.show(
            event.target === 'floor' ? 'Floor: dry.' : 'Gone.',
            900
          )
          sfx.play('ding', { pitch: 1.3, volume: 0.6 })
          break
        case 'patchChore':
          this.caption.show('Left it. Chore added.', 1100)
          sfx.play('tick')
          break
        case 'dry':
          this.caption.show('Leaked dry. Mend those holes.', 1600)
          this.despairMs = RESULT_MS
          sfx.play('drip', { pitch: 0.6 })
          sfx.play('fail', { volume: 0.6 })
          break
        case 'yearTwo':
          this.caption.queue('Year 2. Same well.', 1800)
          break
        case 'nearMiss':
          this.caption.show(`So close. ${litres(event.shortMl)} short.`, 1800)
          sfx.play('fail', { volume: 0.6 })
          this.film.snapSoon(timeMs, NEAR_MISS_SNAP_MS, HOUSE_BAND)
          break
        case 'ended':
          // Skipped before the bathtub snap: the card gets the last frame instead of an
          // older milestone's picture.
          if (!this.endingSnapped) this.film.snapSoon(timeMs, 0, ROOM_BAND)
          break
        case 'lastTrip':
          this.caption.queue(
            event.really ? 'Last Trip. Really.' : 'Last Trip.',
            1500
          )
          sfx.play('ding', { pitch: 0.8 })
          break
        case 'floorSplash':
          sfx.play('splat')
          break
        case 'catch':
          this.caption.show('Caught it.', 900)
          sfx.play('whoosh')
          this.kickSquash(0.7)
          break
        case 'grip':
          sfx.play('pop', { volume: 0.4, pitch: 1.3 })
          break
        case 'footstep':
          footstep(state.kit.slippers)
          break
        case 'realStep':
          // A stomp you can hear from downstairs; the drain follows on its own.
          if (event.stomp) {
            sfx.play('stomp')
            this.shake.kick(6, 200)
          }
          break
        case 'realWalk':
          this.caption.show(
            event.on ? 'Walk for real. Gently.' : 'Thumbs again.',
            1400
          )
          sfx.play('pop', { pitch: event.on ? 1.2 : 0.8 })
          break
        case 'fatigue':
          this.caption.show('Arms. Going.')
          for (let i = 0; i < 6; i++)
            this.world.spawn(
              Kind.Sweat,
              HERO_X_OUT + 6,
              GROUND_Y - 240,
              (Math.random() - 0.5) * 300,
              -200 - Math.random() * 150,
              700,
              GROUND_Y
            )
          break
        case 'scene':
          // Reduced Motion cuts straight to the next scene.
          if (!settings.get().reducedMotion) this.whipMs = WHIP_MS
          this.whipDir = event.scene === 'path' ? 1 : -1
          sfx.play('whoosh', { volume: 0.5 })
          break
        case 'dip':
          sfx.play('splash', { pitch: 0.7, volume: 0.5 })
          break
        case 'scoop':
          sfx.play('slosh', { volume: 0.6 })
          break
        case 'crank':
          if (event.result === 'slam') {
            this.caption.show('Gently.', 1100)
            this.shake.kick(5, 200)
            sfx.play('slam')
          } else if (event.result === 'up') {
            // Fast circles slop scoops out on the way up; say how many, so the low water makes sense.
            const slopped = SCOOPS_PER_FILL - this.sim.state.well.scoopsLeft
            this.caption.show(
              slopped > 0
                ? `Bucket up. ${slopped} ${slopped === 1 ? 'scoop' : 'scoops'} slopped.`
                : 'Bucket up.',
              slopped > 0 ? 1800 : 1100
            )
            if (slopped > 0) sfx.play('slam', { volume: 0.6 })
            sfx.play('ding', { volume: 0.6 })
          } else {
            sfx.play('crank', { pitch: 0.8 + event.turns * 0.08 })
          }
          break
        case 'crankSpin':
          this.caption.show("Don't let go.", 1300)
          sfx.play('rattle')
          break
        case 'blocked':
          this.caption.show(event.message, 1300)
          sfx.play('tick')
          break
        case 'refill':
          this.caption.show('The well needs 1 min.', 1500)
          sfx.play('rattle', { volume: 0.6 })
          break
        case 'refillDone':
          sfx.play('ding')
          break
        case 'frog':
          sfx.play('pop', { pitch: 1.6 })
          break
        case 'frogBack':
          this.caption.show('It hopped back.', 1300)
          sfx.play('pop', { pitch: 1.8 })
          break
        case 'frogGone':
          this.caption.show('Off you hop.', 1300)
          sfx.play('pop', { pitch: 1.4 })
          break
        case 'bump':
          sfx.play('thud', { volume: 0.5, pitch: 0.7 })
          this.shake.kick(3, 150)
          this.kickSquash(0.4 + event.speed / 10)
          if (event.mole) {
            this.path.mole = { index: event.index, t: 0 }
            sfx.play('pop', { pitch: 1.2 })
          }
          break
        case 'slip': {
          if (event.carrying) {
            this.fallOver()
          } else {
            this.fallTotal = 2000
            this.fallMs = this.fallTotal
            this.shake.kick(5, 250)
            sfx.play('whoosh')
            sfx.play('thud', { volume: 0.8 })
            this.caption.show(
              event.kind === 'ice' ? 'Ice. Of course.' : 'Whoops.',
              1200
            )
          }
          break
        }
        case 'leavesIn':
          this.caption.show(
            event.cause === 'wind'
              ? 'Wind. Leaves in the well.'
              : event.count === 1
                ? 'A leaf came up too.'
                : `${event.count} leaves came up too.`,
            1400
          )
          sfx.play('wind', { volume: 0.5 })
          if (event.cause === 'wind') this.gust()
          break
        case 'leafOut':
          sfx.play('whoosh', { pitch: 1.5, volume: 0.6 })
          sfx.play('pop', { pitch: 1.3, volume: 0.5 })
          this.cam.spawn(
            Kind.Leaf,
            this.pond.lastOut.x,
            this.pond.lastOut.y,
            this.pond.lastOut.x < CAM_X ? -500 : 500,
            -160,
            800
          )
          if (event.left === 0) this.caption.show('Leaves: out.', 1000)
          break
        case 'clogged':
          this.caption.show(
            event.leaves === 1 ? 'A leaf. On the mesh.' : 'Leaves. Clogged.',
            1100
          )
          sfx.play('squish', { volume: 0.5 })
          break
        case 'eventStep':
          // A held-in sneeze, a passing dog or a buzzing pocket still jolts the sieve.
          this.kickSquash(0.5)
          this.events.react(event)
          break
        case 'eventStart':
        case 'eventMissed':
        case 'call':
          this.events.react(event)
          break
        case 'rain':
          this.reactRain(event.stage, event.gag)
          break
        case 'catStart':
          // You find out at the house; from the well you only hear it.
          if (event.scene === 'house') {
            this.caption.show('The cat! In your water.', 1400)
            sfx.play('meow')
          } else if (event.scene !== 'path') {
            toast('Lapping sounds from the house.', 'bad', 4000)
          }
          break
        case 'catSeen':
          this.caption.queue('The cat! Drinking your water.', 1400)
          sfx.play('meow')
          break
        case 'catShooed': {
          const room = ROOM_FOR[event.room] ?? 'step'
          const spot = catSpot(room)
          this.house.shoo(room, timeMs)
          this.knocks.knock(room, spot.x, spot.y - 30)
          this.caption.show('Shoo!', 1000)
          this.shake.kick(4, 220)
          sfx.play('meow', { pitch: 1.4 })
          sfx.play('whoosh')
          sfx.play('slam', { volume: 0.5, pitch: 1.4 })
          break
        }
        case 'plugPulled':
          if (event.scene === 'house') {
            this.caption.show('The cat pulled the plug!', 1400)
            sfx.play('meow')
          } else if (event.scene !== 'path') {
            toast('Gurgle… was that the tub?', 'bad', 4000)
          }
          sfx.play('pour', { pitch: 0.5, volume: 0.5 })
          break
        case 'plugFixed':
          this.caption.show('Plugged.', 1000)
          sfx.play('pop', { pitch: 0.7 })
          sfx.play('ding', { pitch: 1.2, volume: 0.6 })
          break
        case 'plugMiss':
          sfx.play('boing', { volume: 0.4 })
          break
        case 'floorWarn':
          this.caption.queue('Wet floor ahead. Tiptoe.', 1500)
          sfx.play('drip', { pitch: 0.7, volume: 0.6 })
          break
        case 'suggestAssist':
          toast(
            '4 drains in a row. Assist Mode in Settings loosens the limits.',
            'info',
            6000
          )
          break
        case 'inputSwitched':
          // You didn't ask for this pause, so a sound marks it.
          sfx.play('pop', { pitch: 0.8 })
          vibrate(20)
          break
        case 'patch':
        case 'pause':
        case 'resume':
          break
      }
    }
    events.length = 0
    if (
      state.steady.zone === 'slosh' &&
      timeMs - this.lastSloshSfx > SLOSH_SFX_GAP_MS
    ) {
      this.lastSloshSfx = timeMs
      sfx.play('slosh', { volume: 0.35 })
    }
  }

  /** Draws every cached layer invisibly once, so each paints now rather than mid-game. */
  private warm(ctx: CanvasRenderingContext2D): void {
    this.warmPending = false
    ctx.save()
    ctx.globalAlpha = 0
    const layers = [
      ...this.path.layers,
      ...this.well.layers,
      ...this.house.layers,
      ...this.sieveCam.layers,
      ...this.cutscenes.layers,
      ...this.bench.layers,
      ...this.leafArt.layers
    ]
    for (const layer of layers) layer.draw(ctx)
    ctx.restore()
  }

  /** Plays the sounds, captions, shakes and actions of the cutscene moments just passed. */
  private playCues(timeMs: number): void {
    const state = this.sim.state
    if (state.scene !== 'cutscene' || !isCutscene(state.phase)) {
      this.cuedMs = -1
      return
    }
    const ms = state.phaseMs
    for (const cue of CUES[state.phase]) {
      if (cue.at <= this.cuedMs || cue.at > ms) continue
      if (cue.sound)
        sfx.play(cue.sound, { pitch: cue.pitch, volume: cue.volume })
      if (cue.caption) this.caption.show(cue.caption, cue.captionMs)
      if (cue.shake) this.shake.kick(cue.shake, 300)
      if (cue.action) this.cueAction(cue.action, timeMs)
    }
    this.cuedMs = ms
  }

  private cueAction(action: NonNullable<Cue['action']>, timeMs: number): void {
    switch (action) {
      case 'snap':
        this.film.snapSoon(timeMs, 0, ROOM_BAND)
        if (this.sim.state.phase === 'ending') this.endingSnapped = true
        break
      case 'kick':
        this.tumbles.kickBucket(KICK.x, KICK.y, KICK.vx, KICK.vy, SHED_WALL_X)
        break
      case 'shut':
        this.tumbles.clear()
        break
      case 'leaves':
        this.dropLeaves()
    }
  }

  /** A gust blows a handful of leaves across the scene toward the well. */
  private gust(): void {
    const view = this.viewport.view
    for (let i = 0; i < 14; i++)
      this.world.spawn(
        Kind.Leaf,
        view.x + view.width + Math.random() * 200,
        300 + Math.random() * 380,
        -420 - Math.random() * 200,
        40 + Math.random() * 40,
        2600,
        GROUND_Y + 10
      )
  }

  /** Autumn leaves drift down across the whole view, staggered so they keep coming. */
  private dropLeaves(): void {
    const view = this.viewport.view
    for (let i = 0; i < 36; i++)
      this.world.spawn(
        Kind.Leaf,
        view.x + Math.random() * view.width,
        view.y - Math.random() * 500,
        0,
        70 + Math.random() * 60,
        9000,
        GROUND_Y + 10
      )
  }

  /** A tick that speeds up as a bump nears while you carry water. */
  private bumpTicks(timeMs: number): void {
    const state = this.sim.state
    if (state.scene !== 'path' || state.phase !== 'carry') return
    const ahead = nextBumpAhead(state.path, state.walker.distance)
    if (ahead > WARN_AHEAD_M) return
    const gap = 90 + ahead * 45
    if (timeMs - this.lastTickAt < gap) return
    this.lastTickAt = timeMs
    sfx.play('tick', {
      volume: 0.5,
      pitch: 1 + (1 - ahead / WARN_AHEAD_M) * 0.6
    })
  }

  /** A jolt squashes the cam sieve; a bigger jolt squashes it harder. */
  private kickSquash(amount: number): void {
    if (settings.get().reducedMotion) return
    this.squashAmp = Math.max(
      this.squashAmp * (this.squashMs / SQUASH_MS),
      amount
    )
    this.squashMs = SQUASH_MS
  }

  /** The cam sieve's squash now: wide and flat first, then tall, settling to round. */
  private squash(): number {
    if (this.squashMs <= 0) return 0
    const t = 1 - this.squashMs / SQUASH_MS
    return this.squashAmp * SQUASH_SCALE * Math.cos(t * Math.PI * 2) * (1 - t)
  }

  /** The crank creaks at each quarter turn; the full circle has its own, louder creak. */
  private crankTicks(): void {
    const quarter = Math.floor(this.sim.state.well.crankProgress * 4)
    if (quarter > this.crankQuarter && quarter < 4)
      sfx.play('crank', { volume: 0.35, pitch: 0.75 + quarter * 0.05 })
    this.crankQuarter = quarter
  }

  /** Where the side-view sieve is in the current scene. */
  private sievePosition(): { x: number; y: number } {
    const state = this.sim.state
    if (state.scene === 'well') {
      this.side.x = WELL_X + state.grip.offsetX * 0.6
      this.side.y = state.well.sieveY
      return this.side
    }
    const heroX = state.scene === 'house' ? this.house.heroX(state) : HERO_X_OUT
    return sideSievePosition(heroX, GROUND_Y, 1, this.side)
  }

  /**
   * The pour loop follows the flow; fast pours throw splashes off the rim. In the ending
   * it roars while every tap in the house runs.
   */
  private pourEffects(timeMs: number): void {
    const state = this.sim.state
    const flow =
      state.scene === 'house' && state.phase === 'pour' ? state.house.flow : 0
    const ms = state.phaseMs
    const taps =
      state.phase === 'ending' &&
      !state.ended &&
      ms >= TAPS_ON_MS &&
      ms < STARE_MS
    if (flow > 0 || taps) {
      this.pourLoop ??= sfx.loop('pour')
      this.pourLoop.setVolume(taps ? 0.8 : Math.min(1, flow / 2))
    } else if (this.pourLoop) {
      this.pourLoop.stop()
      this.pourLoop = null
    }
    if (flow <= POUR_SAFE_LPS || timeMs - this.lastSplashAt < 60) return
    this.lastSplashAt = timeMs
    const y = this.house.waterY(state)
    const x = this.house.pourX(state)
    for (let i = 0; i < 3; i++)
      this.world.spawn(
        Kind.Splash,
        x + (Math.random() - 0.5) * 40,
        y,
        (Math.random() - 0.5) * 500,
        -250 - Math.random() * 300,
        700,
        GROUND_Y + 6
      )
    sfx.play('splat', { volume: 0.4, pitch: 0.9 + Math.random() * 0.3 })
  }

  /** Turns dripped water into falling drops, ripples and capped drip sounds. */
  private spawnDrips(timeMs: number): void {
    this.spawnHoleDrips()
    const fx = this.sim.state.fx
    const total = fx.dripMl + fx.sloshMl + fx.dribbleMl
    if (total < ML_PER_DRIP) return
    const state = this.sim.state
    const drops = Math.min(4, Math.floor(total / ML_PER_DRIP))
    fx.dripMl = fx.sloshMl = fx.dribbleMl = 0
    const pos = this.sievePosition()
    const sx = CAM_X + state.grip.offsetX * CAM_OFFSET_SCALE
    const sy = CAM_Y + state.grip.offsetY * CAM_OFFSET_SCALE
    for (let i = 0; i < drops; i++) {
      this.world.spawn(
        Kind.Drip,
        pos.x + (Math.random() - 0.5) * 60,
        pos.y + 8,
        -state.walker.speed * 12,
        40,
        900,
        GROUND_Y + 4
      )
      this.cam.spawn(
        Kind.Ripple,
        sx + (Math.random() - 0.5) * 90,
        sy + (Math.random() - 0.5) * 90,
        0,
        0,
        500
      )
    }
    // A tilted sieve dribbles faster and faster as it tips toward pouring out.
    const tip = state.dribbling ? Math.min(1, (state.tiltDeg - 12) / 18) : 0
    if (timeMs - this.lastDripSfx > DRIP_SFX_GAP_MS * (1 - tip * 0.6)) {
      this.lastDripSfx = timeMs
      sfx.play('drip', {
        volume: 0.3 + tip * 0.2,
        pitch: 0.8 + Math.random() * 0.5
      })
    }
  }

  /** Each hole in the mesh rings with ripples as water leaks through it. */
  private spawnHoleDrips(): void {
    const state = this.sim.state
    const fx = state.fx
    if (fx.holeMl < ML_PER_DRIP * 2) return
    fx.holeMl = 0
    const sx = CAM_X + state.grip.offsetX * CAM_OFFSET_SCALE
    const sy = CAM_Y + state.grip.offsetY * CAM_OFFSET_SCALE
    for (const hole of state.holes) {
      const r = hole.dist * (SIEVE_RADIUS - 10)
      this.cam.spawn(
        Kind.Ripple,
        sx + Math.cos(hole.angle) * r,
        sy + Math.sin(hole.angle) * r,
        0,
        0,
        450
      )
    }
    const pos = this.sievePosition()
    this.world.spawn(Kind.Drip, pos.x, pos.y + 8, 0, 60, 900, GROUND_Y + 4)
  }

  private splash(fraction: number): void {
    const pos = this.sievePosition()
    const count = Math.round(12 + 24 * Math.min(1, fraction))
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
      const speed = 250 + Math.random() * 450
      this.world.spawn(
        Kind.Splash,
        pos.x,
        pos.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        900,
        GROUND_Y + 6
      )
    }
    for (let i = 0; i < 10; i++)
      this.cam.spawn(
        Kind.Ripple,
        CAM_X + (Math.random() - 0.5) * 160,
        CAM_Y + (Math.random() - 0.5) * 160,
        0,
        0,
        700
      )
  }
}

/** Dresses the hero from the kit: the hat, the slippers, the swatter in the back pocket. */
function dress(state: Sim['state']): void {
  const kit = state.kit
  outfit.hat = kit.hat
  outfit.feet =
    kit.slippers === 'dry'
      ? 'slippers'
      : kit.slippers === 'soaked'
        ? 'soaked'
        : 'bare'
  outfit.swatter = kit.swatter && kit.swingMs <= 0
  outfit.fineMesh = state.gear.finerMesh
  outfit.bigSieve = state.gear.biggerSieve
}

/** A footstep: a soft pat in dry slippers, a squelch in soaked ones, a thud barefoot. */
function footstep(slippers: Sim['state']['kit']['slippers']): void {
  const pitch = 0.85 + Math.random() * 0.3
  if (slippers === 'soaked') sfx.play('squish', { volume: 0.25, pitch })
  else sfx.play('thud', { volume: slippers === 'dry' ? 0.075 : 0.15, pitch })
}

const SWING_MISSES = ['Swatting air.', 'Nothing there.', 'Missed nothing.']

/** A caption for a swing at nothing, a different one each time. */
function swingMiss(count: number): string {
  return SWING_MISSES[count % SWING_MISSES.length] ?? 'Swish.'
}

/** Tips over fast, stays down, gets back up: 0 to 1 over a slip's progress. */
function fallCurve(progress: number, active: boolean): number {
  if (!active) return 0
  if (progress < 0.15) return progress / 0.15
  if (progress > 0.8) return (1 - progress) / 0.2
  return 1
}

/** What each spring rain's caption says as it starts. */
const RAIN_LINES: Record<RainGag, string> = {
  plain: 'Rain! Through the skylight! Into the tub!',
  umbrella: 'Someone put an umbrella over the tub.',
  scoop: 'Rain again. Catch some with the sieve!',
  rainbow: 'A rainbow. Over your tub.'
}

/** What each new season's caption says. */
const SEASON_LINES: Record<Season, string> = {
  summer: 'Summer.',
  autumn: 'Autumn.',
  winter: "Winter. The crank's frozen stiff.",
  spring: 'Spring. Smells like rain.'
}

const THREAD_MISSES = [
  'Missed. Again.',
  'The eye moved. Again.',
  'So close. Again.',
  'Wait for the sway.'
]

/** A caption for a missed threading, a different one each time. */
function threadMiss(count: number): string {
  return THREAD_MISSES[count % THREAD_MISSES.length] ?? 'Missed.'
}
