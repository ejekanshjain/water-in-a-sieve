import type { GameState } from '../game/sim'
import { TUNED, tuneValue } from '../game/tune'
import { DESIGN_HEIGHT, HERO_X_BACK, HERO_X_OUT } from '../game/tuning'
import type { InputMode } from '../game/types'
import { palette } from '../shared'
import { layout } from './layout'
import type { PhoneTilt } from './motion'
import type { PathScene } from './path'
import { perf } from './perf'

/**
 * The `?debug` overlays. Dev builds only: the renderer calls these behind
 * `import.meta.env.DEV`, so production builds drop this module.
 */

/** The phone numbers `?tune=` overrides, a few to a line, built on first use. */
let tuneLines: string[] | null = null

function tuneOverrides(): string[] {
  tuneLines ??= (tuneValue(TUNED).match(/[^,]+(,[^,]+){0,1}/g) ?? []).map(
    (pair, i) =>
      `${i === 0 ? 'tune' : '    '} ${pair.replaceAll(':', ' ').replace(',', ', ')}`
  )
  return tuneLines
}

/** The stats panel: scene, levels, drift, tilt, the latest drain, frame time and sensors. */
export function drawDebugPanel(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  mode: InputMode,
  tilt: PhoneTilt
): void {
  perf.tick(performance.now())
  const lines = [
    `${s.scene}/${s.phase} trip ${s.trip} ${mode}`,
    `hand ${s.steady.hand.toFixed(2)} body ${s.steady.body.toFixed(2)} total ${s.steady.total.toFixed(2)}`,
    `drift ${s.drift.x.toFixed(0)},${s.drift.y.toFixed(0)} x${s.drift.fatigue.toFixed(2)}`,
    `offset ${s.grip.offsetX.toFixed(0)},${s.grip.offsetY.toFixed(0)} = ${s.tiltDeg.toFixed(1)} deg`,
    `last drain ${s.lastDrain ? `${s.lastDrain.cause} ${s.lastDrain.ml} mL` : 'none'}`,
    `frame ${perf.average.toFixed(1)} ms avg, ${perf.worst.toFixed(1)} worst`,
    `react ${perf.commitsPerSecond} commits/s`,
    motionLine(mode, tilt),
    ...tuneOverrides()
  ]
  // Below the path on desktop; under the distance bar on phones, clear of the sieve cam.
  const top =
    layout.get().mode === 'columns'
      ? Math.min(812, DESIGN_HEIGHT - lines.length * 18 - 12)
      : 470
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillRect(4, top, 420, lines.length * 18 + 8)
  ctx.fillStyle = palette.ink
  ctx.font = '14px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  lines.forEach((line, i) => ctx.fillText(line, 10, top + 6 + i * 18))
}

/** The raw phone readings, for tuning touch grace and the hand limit. */
function motionLine(mode: InputMode, tilt: PhoneTilt): string {
  const source = tilt.source
  if (!source?.available) return `input ${mode}, no motion`
  return `jolt ${source.jolt.toFixed(2)} pk ${source.peakJolt.toFixed(2)} tilt ${tilt.tiltX.toFixed(0)},${tilt.tiltY.toFixed(0)} flat ${tilt.fromFlat.toFixed(0)}${tilt.calibrated ? '' : ' uncal'}`
}

/** Bump and patch positions on the walk strip. */
export function drawDebugMarkers(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  path: PathScene
): void {
  if (state.scene !== 'path' && state.scene !== 'walkBack') return
  const heroX = state.walker.dir < 0 ? HERO_X_BACK : HERO_X_OUT
  const d = state.walker.distance
  ctx.lineWidth = 2
  ctx.font = '12px monospace'
  ctx.textAlign = 'center'
  ctx.strokeStyle = ctx.fillStyle = palette.red
  for (const b of state.path.bumps) {
    const x = path.screenX(b, d, heroX)
    ctx.beginPath()
    ctx.moveTo(x, 600)
    ctx.lineTo(x, 810)
    ctx.stroke()
    ctx.fillText(`bump ${b}`, x, 596)
  }
  ctx.strokeStyle = ctx.fillStyle = palette.blue
  for (const p of state.path.patches) {
    const x = path.screenX(p.at, d, heroX)
    ctx.beginPath()
    ctx.moveTo(x, 620)
    ctx.lineTo(x, 810)
    ctx.stroke()
    ctx.fillText(`${p.kind} ${p.at.toFixed(1)} age ${p.age}`, x, 616)
  }
}
