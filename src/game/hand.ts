import {
  HAND_HOLD_MS,
  HAND_SAMPLE_MS,
  HAND_SMOOTH_MS,
  HAND_WINDOW_MS
} from './tuning'

/**
 * Measures how sharply the gripping hand moves, the same at any frame rate.
 *
 * Feed every pointer move with its event timestamp through `move`. Velocity comes from
 * samples at least 8 ms apart, smoothed over 40 ms, so bursts of events can't spike it.
 * Call `frame` once per rendered frame: it turns the velocity change since the last frame
 * into an acceleration over real frame time. Every fixed step of the next frame feeds that
 * same reading, so 30, 60 and 120 fps read alike. Fast screens measure over at least
 * 15 ms, so alternating empty and busy frames can't double the reading.
 */
export class HandMotion {
  /** Smoothed velocity in units per second. */
  vx = 0
  vy = 0
  /** Latest acceleration in units/s², from the last `frame` call. */
  accel = 0
  private sampleX = 0
  private sampleY = 0
  private sampleAt = 0
  private lastEventAt = 0
  private frameVx = 0
  private frameVy = 0
  private frameAt = -1
  private decayedAt = 0

  /** Starts fresh at a new grip, so a press never reads as a jolt. */
  reset(x: number, y: number, timeMs: number): void {
    this.sampleX = x
    this.sampleY = y
    this.sampleAt = timeMs
    this.lastEventAt = timeMs
    this.vx = this.vy = 0
    this.frameVx = this.frameVy = 0
    this.frameAt = -1
    this.decayedAt = timeMs
    this.accel = 0
  }

  /** Feeds one pointer position with its event timestamp in ms. */
  move(x: number, y: number, timeMs: number): void {
    const dt = timeMs - this.sampleAt
    if (dt < HAND_SAMPLE_MS) return
    // A long gap means the pointer sat still; don't read the jump as speed.
    const fresh = dt < 100
    const ivx = fresh ? ((x - this.sampleX) / dt) * 1000 : 0
    const ivy = fresh ? ((y - this.sampleY) / dt) * 1000 : 0
    const blend = 1 - Math.exp(-dt / HAND_SMOOTH_MS)
    this.vx += (ivx - this.vx) * blend
    this.vy += (ivy - this.vy) * blend
    this.sampleX = x
    this.sampleY = y
    this.sampleAt = timeMs
    this.lastEventAt = timeMs
  }

  /** Call once per rendered frame with the frame time in ms. Returns the new `accel`. */
  frame(timeMs: number): number {
    // A pointer that stopped moving slows down, so stopping dead reads as a jolt too.
    const stillSince = this.lastEventAt + HAND_HOLD_MS
    if (timeMs > stillSince) {
      const decayMs = timeMs - Math.max(this.decayedAt, stillSince)
      const k = Math.exp(-Math.max(0, decayMs) / HAND_SMOOTH_MS)
      this.vx *= k
      this.vy *= k
    }
    this.decayedAt = timeMs
    if (this.frameAt < 0) {
      this.frameAt = timeMs
      this.frameVx = this.vx
      this.frameVy = this.vy
      this.accel = 0
      return 0
    }
    const dt = timeMs - this.frameAt
    if (dt < HAND_WINDOW_MS) {
      // Too soon to measure fairly; a still pointer still reads 0.
      if (this.vx === this.frameVx && this.vy === this.frameVy) this.accel = 0
      return this.accel
    }
    const dv = Math.hypot(this.vx - this.frameVx, this.vy - this.frameVy)
    this.accel = dv / (dt / 1000)
    this.frameVx = this.vx
    this.frameVy = this.vy
    this.frameAt = timeMs
    return this.accel
  }
}
