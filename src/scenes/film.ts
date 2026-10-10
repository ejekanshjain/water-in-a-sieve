import type { DrainRecord } from '../game/replays'
import {
  DESIGN_HEIGHT,
  REPLAY_AFTER_MS,
  REPLAY_FPS,
  REPLAY_HEIGHT,
  REPLAY_SECONDS,
  REPLAY_WIDTH
} from '../game/tuning'
import {
  ReplayRecorder,
  type CropRect,
  type ReplayClip,
  type Viewport
} from '../shared'

/** One drain on film: its slow-mo clip and what the replay and share card say about it. */
export interface FailShot {
  id: number
  /** Valid until the next drain's clip, which records over it. */
  clip: ReplayClip
  drain: DrainRecord
  /** The caption the drain got, such as "A fly. One fly." */
  caption: string
  /** Water lost so far when it happened, for the card's Total Lost. */
  lostMl: number
}

/** The longest side of a moment's still, in pixels. */
const STILL_SIZE = 960

/** A horizontal band of the design, in logical y, for a still that only needs part of it. */
export interface Band {
  top: number
  bottom: number
}

/** Cutscene stills: the room from the top of its wall to the floor, so it fills the card. */
export const ROOM_BAND: Band = { top: 340, bottom: 790 }
/** A near miss in the house: the caption under the sieve cam, you and the tub. */
export const HOUSE_BAND: Band = { top: 460, bottom: 800 }

/**
 * Films the design area for fail replays and share cards. It keeps the last 3s at 180 x
 * 320 and 20 fps, and cuts a clip shortly after every drain, so the clip ends on the
 * splash. It also snaps sharp stills of moments worth sharing: a near miss, a bathtub
 * milestone and you in the full tub.
 */
export class FailFilm {
  private readonly recorder = new ReplayRecorder({
    width: REPLAY_WIDTH,
    height: REPLAY_HEIGHT,
    fps: REPLAY_FPS,
    seconds: REPLAY_SECONDS
  })
  private crop: CropRect | null = null
  private pending: Omit<FailShot, 'id' | 'clip'> | null = null
  private clipAt = -1
  private snapAt = -1
  private snapBand: Band | null = null
  private readonly bandRect: CropRect = { x: 0, y: 0, width: 0, height: 0 }
  private nextId = 1
  private still: HTMLCanvasElement | null = null
  private readonly stopResize: () => void
  /** Runs when a drain's clip is ready. */
  onClip: (shot: FailShot) => void = () => {}
  /** Runs when a moment's still is ready. The canvas is reused by the next one. */
  onMoment: (still: HTMLCanvasElement) => void = () => {}

  constructor(private readonly viewport: Viewport) {
    this.stopResize = viewport.onResize(() => {
      this.crop = null
    })
  }

  dispose(): void {
    this.stopResize()
  }

  /** A drain just happened: cut its clip REPLAY_AFTER_MS from now. */
  noteDrain(
    drain: DrainRecord,
    caption: string,
    lostMl: number,
    timeMs: number
  ): void {
    this.pending = { drain: { ...drain }, caption, lostMl }
    this.clipAt = timeMs + REPLAY_AFTER_MS
  }

  /** Snaps a still `delayMs` from now, of the whole design or just `band` of it. */
  snapSoon(timeMs: number, delayMs = 0, band: Band | null = null): void {
    this.snapAt = timeMs + delayMs
    this.snapBand = band
  }

  /** Takes a due still now. Call it once the frame's world and captions are drawn. */
  snapIfDue(timeMs: number): void {
    const canvas = this.viewport.canvas
    if (this.snapAt < 0 || timeMs < this.snapAt || !canvas) return
    this.snapAt = -1
    const rect = this.bandCrop(this.snapBand)
    const scale = Math.min(1, STILL_SIZE / Math.max(rect.width, rect.height))
    const still = (this.still ??= document.createElement('canvas'))
    const width = Math.max(1, Math.round(rect.width * scale))
    const height = Math.max(1, Math.round(rect.height * scale))
    if (still.width !== width) still.width = width
    if (still.height !== height) still.height = height
    const ctx = still.getContext('2d')
    if (!ctx) return
    ctx.drawImage(
      canvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      width,
      height
    )
    this.onMoment(still)
  }

  /**
   * Records this frame unless `still` (a paused game or the ending screen is no use in a
   * replay), and cuts a due clip. Call it after the whole frame is drawn.
   */
  record(timeMs: number, still: boolean): void {
    const canvas = this.viewport.canvas
    if (!canvas) return
    if (!still) this.recorder.capture(canvas, this.cropRect(), timeMs)
    const pending = this.pending
    if (!pending || timeMs < this.clipAt) return
    this.pending = null
    this.clipAt = -1
    const clip = this.recorder.clip()
    if (clip) this.onClip({ id: this.nextId++, clip, ...pending })
  }

  /** The design area in canvas pixels, cached until the next resize. */
  private cropRect(): CropRect {
    this.crop ??= this.viewport.designRect()
    return this.crop
  }

  /** Part of the design area in canvas pixels: the whole of it, or one band. */
  private bandCrop(band: Band | null): CropRect {
    const rect = this.cropRect()
    if (!band) return rect
    const k = rect.height / DESIGN_HEIGHT
    const out = this.bandRect
    out.x = rect.x
    out.y = rect.y + band.top * k
    out.width = rect.width
    out.height = (band.bottom - band.top) * k
    return out
  }
}
