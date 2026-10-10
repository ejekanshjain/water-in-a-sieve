import { palette, settings, sketchText, type SketchTextStyle } from '../shared'

/** Particle kinds; each has its own look and physics. */
export const Kind = {
  Drip: 0,
  Splash: 1,
  Ripple: 2,
  Sweat: 3,
  Dust: 4,
  /** An autumn leaf: drifts down slowly, swaying. */
  Leaf: 5
} as const
export type Kind = (typeof Kind)[keyof typeof Kind]

const MAX_PARTICLES = 160
const GRAVITY = 1400

/**
 * One preallocated pool of particles in typed arrays: drips, splash droplets, ripples
 * in the sieve cam, sweat and dust. Spawning when full recycles the oldest slot.
 */
export class Particles {
  private readonly x = new Float32Array(MAX_PARTICLES)
  private readonly y = new Float32Array(MAX_PARTICLES)
  private readonly vx = new Float32Array(MAX_PARTICLES)
  private readonly vy = new Float32Array(MAX_PARTICLES)
  private readonly life = new Float32Array(MAX_PARTICLES)
  private readonly maxLife = new Float32Array(MAX_PARTICLES)
  private readonly floor = new Float32Array(MAX_PARTICLES)
  private readonly kind = new Uint8Array(MAX_PARTICLES)
  private next = 0

  spawn(
    kind: Kind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    lifeMs: number,
    floorY = Infinity
  ): void {
    const i = this.next
    this.next = (this.next + 1) % MAX_PARTICLES
    this.kind[i] = kind
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.life[i] = lifeMs
    this.maxLife[i] = lifeMs
    this.floor[i] = floorY
  }

  /** Moves particles on by `dtMs` of simulation time. */
  update(dtMs: number): void {
    const dt = dtMs / 1000
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if ((this.life[i] ?? 0) <= 0) continue
      this.life[i] = (this.life[i] ?? 0) - dtMs
      const k = this.kind[i]
      if (k === Kind.Ripple) continue
      if (k === Kind.Leaf) {
        // Leaves drift at their own speed and sway; they vanish at the floor.
        this.x[i] =
          (this.x[i] ?? 0) +
          ((this.vx[i] ?? 0) + Math.sin((this.life[i] ?? 0) / 260 + i) * 60) *
            dt
        this.y[i] = (this.y[i] ?? 0) + (this.vy[i] ?? 0) * dt
        if ((this.y[i] ?? 0) >= (this.floor[i] ?? Infinity)) this.life[i] = 0
        continue
      }
      const falls = k !== Kind.Dust
      if (falls) this.vy[i] = (this.vy[i] ?? 0) + GRAVITY * dt
      this.x[i] = (this.x[i] ?? 0) + (this.vx[i] ?? 0) * dt
      this.y[i] = (this.y[i] ?? 0) + (this.vy[i] ?? 0) * dt
      const floor = this.floor[i] ?? Infinity
      if ((this.y[i] ?? 0) >= floor) {
        // Landed: become a short-lived flat splat.
        this.y[i] = floor
        this.vx[i] = 0
        this.vy[i] = 0
        this.kind[i] = Kind.Dust
        this.life[i] = Math.min(this.life[i] ?? 0, 300)
        this.maxLife[i] = 300
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const life = this.life[i] ?? 0
      if (life <= 0) continue
      const t = life / (this.maxLife[i] || 1)
      const x = this.x[i] ?? 0
      const y = this.y[i] ?? 0
      switch (this.kind[i]) {
        case Kind.Drip:
        case Kind.Sweat:
          ctx.fillStyle = palette.water
          ctx.beginPath()
          ctx.ellipse(x, y, 3, 4.5, 0, 0, Math.PI * 2)
          ctx.fill()
          break
        case Kind.Splash:
          ctx.globalAlpha = Math.min(1, t * 1.5)
          ctx.fillStyle = palette.water
          ctx.beginPath()
          ctx.arc(x, y, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
          break
        case Kind.Ripple:
          ctx.globalAlpha = t
          ctx.strokeStyle = palette.blue
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, 4 + (1 - t) * 14, 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = 1
          break
        case Kind.Dust:
          ctx.globalAlpha = t * 0.8
          ctx.fillStyle = palette.water
          ctx.beginPath()
          ctx.ellipse(x, y, 7, 2.5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
          break
        case Kind.Leaf:
          ctx.fillStyle = i % 3 === 0 ? palette.yellow : palette.orange
          ctx.strokeStyle = palette.ink
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.ellipse(x, y, 9, 4.5, Math.sin(life / 200 + i), 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          break
      }
    }
  }

  clear(): void {
    this.life.fill(0)
  }
}

/** Screen shake that decays over its duration. Reduced Motion turns it off. */
export class Shake {
  private amplitude = 0
  private msLeft = 0
  private duration = 1

  kick(amplitude: number, ms: number): void {
    if (settings.get().reducedMotion) return
    if (amplitude < this.amplitude * (this.msLeft / this.duration)) return
    this.amplitude = amplitude
    this.msLeft = ms
    this.duration = ms
  }

  update(dtMs: number): void {
    this.msLeft = Math.max(0, this.msLeft - dtMs)
  }

  /** Current offset on one axis; `axis` 0 or 1 picks a different wave. */
  offset(timeMs: number, axis: 0 | 1): number {
    // Turning Reduced Motion on mid-shake stops it at once.
    if (this.msLeft <= 0 || settings.get().reducedMotion) return 0
    const k = this.msLeft / this.duration
    const wave = axis === 0 ? Math.sin(timeMs * 0.09) : Math.cos(timeMs * 0.11)
    return this.amplitude * k * wave
  }
}

/** The caption's text style; its size, seed and fade are set per frame. */
const CAPTION_TEXT: SketchTextStyle = {
  font: 'marker',
  size: 44,
  tilt: 0.08,
  seed: 1,
  outline: palette.paper,
  maxWidth: 500,
  alpha: 1
}

/** One big comedic caption at a time, in Permanent Marker. */
export class Caption {
  text = ''
  private msLeft = 0
  private duration = 1
  private seed = 1

  private next: { text: string; ms: number } | null = null

  show(text: string, ms = 1600): void {
    this.text = text
    this.msLeft = ms
    this.duration = ms
    this.seed++
  }

  /** Shows `text` once the current caption ends, or now when none is showing. */
  queue(text: string, ms = 1600): void {
    if (this.msLeft <= 0) this.show(text, ms)
    else this.next = { text, ms }
  }

  update(dtMs: number): void {
    this.msLeft = Math.max(0, this.msLeft - dtMs)
    if (this.msLeft > 0 || !this.next) return
    this.show(this.next.text, this.next.ms)
    this.next = null
  }

  get visible(): boolean {
    return this.msLeft > 0
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (this.msLeft <= 0) return
    // Pop in over the first 120 ms.
    const age = this.duration - this.msLeft
    const pop = age < 120 ? 0.6 + (age / 120) * 0.4 : 1
    const style = CAPTION_TEXT
    style.size = Math.round(44 * pop)
    style.seed = this.seed
    style.alpha = Math.min(1, this.msLeft / 200)
    sketchText(ctx, this.text, x, y, style)
  }
}
