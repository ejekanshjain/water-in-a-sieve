import {
  CALIBRATE_DRIFT_DEGREES,
  CALIBRATE_MAX_DEGREES,
  CALIBRATE_STEADY_MS,
  CALIBRATE_STILL_JOLT,
  REFINE_MAX_DEGREES,
  REFINE_TIMEOUT_MS
} from '../game/tuning'

/** The parts of a motion source the game reads: the shared `Motion` or a dev fake. */
export interface MotionSource {
  readonly available: boolean
  /** Degrees from the source's own calibrated pose. */
  readonly tiltX: number
  readonly tiltY: number
  /** Smoothed jolt in m/s², and the recent peak. */
  readonly jolt: number
  readonly peakJolt: number
  calibrate(): void
}

/** A fixed reading for dev tools and tests. Its tilt is raw until calibrated. */
export class FakeMotion implements MotionSource {
  readonly available = true
  jolt = 0
  peakJolt = 0
  rawX = 0
  rawY = 0
  private baseX = 0
  private baseY = 0

  get tiltX(): number {
    return this.rawX - this.baseX
  }

  get tiltY(): number {
    return this.rawY - this.baseY
  }

  calibrate(): void {
    this.baseX = this.rawX
    this.baseY = this.rawY
  }
}

/**
 * Why calibration is waiting: no sensor data yet, a pose too far from flat, or a phone
 * still moving. 'idle' means no calibration is wanted.
 */
export type CalibrationStatus = 'idle' | 'noData' | 'flatter' | 'moving'

/**
 * What asked for a calibration. 'tray' and 'rotate' accept any pose within 45° of flat;
 * 'refine', after each crank, only nudges level by a few degrees and gives up quietly.
 */
export type CalibrationKind = 'tray' | 'rotate' | 'refine'

/**
 * The phone as the sieve. Tracks the raw pose behind the source's calibrated tilt, so
 * it can refuse poses far from flat, and calibrates once the phone is held still.
 */
export class PhoneTilt {
  source: MotionSource | null = null
  /** Motion mode needs a calibrated level first. */
  calibrated = false
  /** The kind of calibration wanted now, or null. */
  wanted: CalibrationKind | null = null
  status: CalibrationStatus = 'idle'
  /** Raw pose at the last calibration, so raw = tilt + base. */
  private baseX = 0
  private baseY = 0
  private steadyMs = 0
  private waitedMs = 0
  private anchorX = 0
  private anchorY = 0

  /** Tilt from the calibrated level, in degrees. */
  get tiltX(): number {
    return this.source?.tiltX ?? 0
  }

  get tiltY(): number {
    return this.source?.tiltY ?? 0
  }

  /** Degrees from lying flat, screen up, whatever the calibration. */
  get fromFlat(): number {
    if (!this.source) return 0
    return Math.hypot(this.tiltX + this.baseX, this.tiltY + this.baseY)
  }

  /** Swaps the source, such as a dev fake. A new source starts uncalibrated. */
  setSource(source: MotionSource | null): void {
    this.source = source
    this.calibrated = false
    this.baseX = this.baseY = 0
  }

  /** Asks for a calibration once the phone is still. A stronger kind replaces 'refine'. */
  request(kind: CalibrationKind): void {
    if (kind === 'refine' && this.wanted && this.wanted !== 'refine') return
    this.wanted = kind
    this.steadyMs = 0
    this.waitedMs = 0
    this.status = 'moving'
  }

  /** Stops waiting for a calibration. */
  cancel(): void {
    this.wanted = null
    this.status = 'idle'
  }

  /**
   * Treats the current pose as level, if it is within 45° of flat. Returns false and
   * changes nothing otherwise.
   */
  calibrateNow(): boolean {
    const source = this.source
    if (!source?.available || this.fromFlat > CALIBRATE_MAX_DEGREES)
      return false
    this.baseX += source.tiltX
    this.baseY += source.tiltY
    source.calibrate()
    this.calibrated = true
    this.cancel()
    return true
  }

  /** Steps a wanted calibration. Returns true on the step it calibrates. */
  step(dtMs: number): boolean {
    if (!this.wanted) return false
    const source = this.source
    this.waitedMs += dtMs
    if (!source?.available) {
      this.status = 'noData'
      return false
    }
    if (this.wanted === 'refine') {
      const off = Math.hypot(this.tiltX, this.tiltY)
      if (this.waitedMs > REFINE_TIMEOUT_MS || !this.calibrated) {
        this.cancel()
        return false
      }
      if (off > REFINE_MAX_DEGREES) {
        this.steadyMs = 0
        return false
      }
    } else if (this.fromFlat > CALIBRATE_MAX_DEGREES) {
      this.status = 'flatter'
      this.steadyMs = 0
      return false
    }
    const drift = Math.hypot(
      this.tiltX - this.anchorX,
      this.tiltY - this.anchorY
    )
    if (source.jolt > CALIBRATE_STILL_JOLT || drift > CALIBRATE_DRIFT_DEGREES) {
      this.status = 'moving'
      this.steadyMs = 0
      this.anchorX = this.tiltX
      this.anchorY = this.tiltY
      return false
    }
    this.steadyMs += dtMs
    if (this.steadyMs < CALIBRATE_STEADY_MS) return false
    return this.calibrateNow()
  }
}
