/**
 * Dev probe for the `?debug` overlay: render time per frame and React commits per second.
 * The game records into it behind `import.meta.env.DEV`, so production builds drop it.
 */
export class PerfProbe {
  private readonly samples = new Float32Array(60)
  private index = 0
  private count = 0
  private commits = 0
  private windowStart = 0
  /** React commits in the last full second. */
  commitsPerSecond = 0

  /** Records one frame's render time in ms. */
  record(ms: number): void {
    this.samples[this.index] = ms
    this.index = (this.index + 1) % this.samples.length
    this.count = Math.min(this.count + 1, this.samples.length)
  }

  /** Counts one React commit. Wire it to a `<Profiler onRender>`. */
  noteCommit(): void {
    this.commits++
  }

  /** Rolls the commit counter over once per second of wall time. */
  tick(nowMs: number): void {
    if (nowMs - this.windowStart < 1000) return
    this.commitsPerSecond = this.commits
    this.commits = 0
    this.windowStart = nowMs
  }

  get average(): number {
    let sum = 0
    for (let i = 0; i < this.count; i++) sum += this.samples[i] ?? 0
    return this.count ? sum / this.count : 0
  }

  get worst(): number {
    let worst = 0
    for (let i = 0; i < this.count; i++)
      worst = Math.max(worst, this.samples[i] ?? 0)
    return worst
  }
}

export const perf = /* @__PURE__ */ new PerfProbe()
