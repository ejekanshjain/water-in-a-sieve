import { useEffect, useMemo, useRef, useState } from 'react'

import {
  checks,
  createTipCount,
  CURRENT_PHONE,
  feedTip,
  readingsText,
  SPIKE_STAGES,
  suggest,
  suggestedNumbers,
  type SpikeStage,
  type SpikeTake,
  type SpikeTakes,
  type TipCount
} from '../game/spike'
import { tuneValue } from '../game/tune'
import { MOTION_DIP_DEGREES } from '../game/tuning'
import {
  Button,
  cn,
  createMotion,
  Panel,
  requestMotionPermission,
  sfx,
  useNow,
  useWakeLock,
  vibrate,
  type Motion
} from '../shared'

/** Seconds of countdown before a take, with a tick each second and a ding to start. */
const COUNTDOWN_S = 3
/** A take that ends on a count waits this long after the last press or tip (ms). */
const COUNT_SETTLE_MS = 1000
/** Without sensor data after this long, the page says how to get it. */
const NO_DATA_MS = 2000

type Screen =
  { kind: 'list' } | { kind: 'stage'; stage: SpikeStage } | { kind: 'results' }

/**
 * Dev only (`?spike`): the real-phone spike. You hold the phone like a tray through 8
 * short takes; the results suggest touch grace, the hand limit and the Walk for Real
 * numbers, check them against the real-phone targets and run the game on them.
 */
export function SpikeRecorder() {
  const [motion, setMotion] = useState<Motion | null>(null)
  const [denied, setDenied] = useState(false)
  const [takes, setTakes] = useState<SpikeTakes>({})
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  useWakeLock(motion !== null)
  useEffect(() => () => motion?.dispose(), [motion])

  const begin = async () => {
    sfx.unlock()
    const permission = await requestMotionPermission()
    if (permission === 'denied') setDenied(true)
    else setMotion(createMotion())
  }

  const saveTake = (take: SpikeTake) => {
    // The still hold is the tray pose: scoop tips count from it, as in the game.
    if (take.stage === 'still') motion?.calibrate()
    setTakes(t => ({ ...t, [take.stage]: take }))
    setScreen({ kind: 'list' })
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-paper px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-ink">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4">
        {!motion ? (
          <Intro denied={denied} onBegin={() => void begin()} />
        ) : screen.kind === 'stage' ? (
          <StageRun
            key={screen.stage.id}
            motion={motion}
            stage={screen.stage}
            onDone={saveTake}
            onBack={() => setScreen({ kind: 'list' })}
          />
        ) : screen.kind === 'results' ? (
          <Results takes={takes} onBack={() => setScreen({ kind: 'list' })} />
        ) : (
          <TakeList
            motion={motion}
            takes={takes}
            onPick={stage => setScreen({ kind: 'stage', stage })}
            onResults={() => setScreen({ kind: 'results' })}
          />
        )}
      </div>
    </div>
  )
}

function Intro({ denied, onBegin }: { denied: boolean; onBegin: () => void }) {
  return (
    <>
      <h1 className="-rotate-1 font-marker text-4xl leading-none">
        Phone Spike
      </h1>
      <p className="text-xl leading-snug">
        Dev only. You hold the phone like a tray through 8 short takes. The
        results suggest the phone numbers for the game.
      </p>
      <p className="text-lg leading-snug text-ink-soft">
        Open this page over HTTPS on the phone. Find room for 50 steps; looping
        a room is fine.
      </p>
      {denied && (
        <p role="alert" className="text-lg text-marker-red">
          Motion access was denied. Allow it in the browser settings, then
          reload.
        </p>
      )}
      <Button size="lg" onClick={onBegin}>
        Begin
      </Button>
    </>
  )
}

function TakeList({
  motion,
  takes,
  onPick,
  onResults
}: {
  motion: Motion
  takes: SpikeTakes
  onPick: (stage: SpikeStage) => void
  onResults: () => void
}) {
  const now = useNow(250)
  const [shownAt] = useState(now)
  const noData = !motion.available && now - shownAt > NO_DATA_MS
  const next = SPIKE_STAGES.find(s => !takes[s.id])
  return (
    <>
      <h1 className="-rotate-1 font-marker text-4xl leading-none">
        Phone Spike
      </h1>
      <p role="status" className="text-lg leading-snug">
        {noData
          ? 'No motion data. Use HTTPS on a phone and allow motion access.'
          : 'Record each take in order. Tap one again to redo it.'}
      </p>
      <ol className="flex flex-col gap-2">
        {SPIKE_STAGES.map((stage, i) => {
          const take = takes[stage.id]
          return (
            <li key={stage.id}>
              <button
                type="button"
                onClick={() => onPick(stage)}
                className={cn(
                  'flex min-h-14 w-full flex-col items-start rounded-sketch border-[3px] border-ink px-3 py-2 text-left',
                  stage === next ? 'bg-marker-yellow/60' : 'bg-white/70'
                )}
              >
                <span className="font-marker text-xl">
                  {i + 1}. {stage.title}
                </span>
                <span className="text-base text-ink-soft">
                  {take ? summary(take) : 'Not recorded'}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <Button
        size="lg"
        disabled={Object.keys(takes).length === 0}
        onClick={onResults}
      >
        See Results
      </Button>
    </>
  )
}

/** "8.0s, jolt up to 0.06 m/s²" for a recorded take. */
function summary(take: SpikeTake): string {
  const seconds = (take.samples[take.samples.length - 1]?.t ?? 0) / 1000
  let max = 0
  for (const s of take.samples) max = Math.max(max, s.jolt)
  return `${seconds.toFixed(1)}s, jolt up to ${max.toFixed(2)} m/s²`
}

/** A take in progress: the readings so far and the counts that end it. */
interface Recording {
  startedAt: number
  take: SpikeTake
  tips: TipCount
  presses: number
  /** `performance.now()` of the latest press or tip that counts. */
  countedAt: number
}

function StageRun({
  motion,
  stage,
  onDone,
  onBack
}: {
  motion: Motion
  stage: SpikeStage
  onDone: (take: SpikeTake) => void
  onBack: () => void
}) {
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'recording'>(
    'ready'
  )
  const [, setTick] = useState(0)
  const countdownAt = useRef(0)
  const recording = useRef<Recording | null>(null)

  const finish = (tappedDone: boolean) => {
    const rec = recording.current
    if (!rec) return
    recording.current = null
    rec.take.tappedDone = tappedDone
    sfx.play('ding', { pitch: 1.5 })
    vibrate(120)
    onDone(rec.take)
  }
  // The latest `finish`, for the interval below, which outlives renders.
  const finishRef = useRef(finish)
  finishRef.current = finish

  // The countdown ticks each second, then starts the take with a ding.
  useEffect(() => {
    if (phase !== 'countdown') return
    let shown = COUNTDOWN_S
    sfx.play('tick')
    const id = window.setInterval(() => {
      const left =
        COUNTDOWN_S - (performance.now() - countdownAt.current) / 1000
      setTick(t => t + 1)
      if (left > 0) {
        if (Math.ceil(left) < shown) {
          shown = Math.ceil(left)
          sfx.play('tick')
        }
        return
      }
      recording.current = {
        startedAt: performance.now(),
        take: { stage: stage.id, samples: [], touches: [], tappedDone: false },
        tips: createTipCount(),
        presses: 0,
        countedAt: 0
      }
      sfx.play('ding')
      setPhase('recording')
    }, 100)
    return () => window.clearInterval(id)
  }, [phase, stage.id])

  // Each sensor reading becomes a sample, read after the shared motion has taken it in.
  useEffect(() => {
    if (phase !== 'recording') return
    const onMotion = () => {
      const rec = recording.current
      if (!rec) return
      const t = performance.now() - rec.startedAt
      rec.take.samples.push({
        t,
        jolt: motion.jolt,
        tiltX: motion.tiltX,
        tiltY: motion.tiltY
      })
      if (feedTip(rec.tips, motion.tiltY)) {
        rec.countedAt = performance.now()
        sfx.play('tick')
      }
    }
    window.addEventListener('devicemotion', onMotion)
    const id = window.setInterval(() => {
      setTick(t => t + 1)
      const rec = recording.current
      if (!rec) return
      const now = performance.now()
      const counted =
        stage.ends === 'presses'
          ? rec.presses
          : stage.ends === 'tips'
            ? rec.tips.tips
            : 0
      const timeUp =
        stage.ends === 'timer' &&
        now - rec.startedAt >= (stage.seconds ?? 0) * 1000
      const countDone =
        counted >= stage.count &&
        (stage.ends === 'presses' || stage.ends === 'tips') &&
        now - rec.countedAt >= COUNT_SETTLE_MS
      if (timeUp || countDone) finishRef.current(false)
    }, 100)
    return () => {
      window.removeEventListener('devicemotion', onMotion)
      window.clearInterval(id)
    }
  }, [phase, motion, stage])

  const touch = (released: boolean) => {
    const rec = recording.current
    if (!rec) return
    rec.take.touches.push(performance.now() - rec.startedAt)
    if (!released) return
    rec.presses++
    rec.countedAt = performance.now()
    sfx.play('tick')
  }

  const rec = recording.current
  const left =
    phase === 'countdown'
      ? Math.ceil(
          COUNTDOWN_S - (performance.now() - countdownAt.current) / 1000
        )
      : 0
  return (
    <>
      <h1 className="-rotate-1 font-marker text-4xl leading-none">
        {stage.title}
      </h1>
      <p className="text-2xl leading-tight text-balance">{stage.how}</p>
      <Live motion={motion} />
      {phase === 'ready' && (
        <>
          <Button
            size="lg"
            onClick={() => {
              countdownAt.current = performance.now()
              setPhase('countdown')
            }}
          >
            Start
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </>
      )}
      {phase === 'countdown' && (
        <p className="text-center font-marker text-7xl" aria-live="polite">
          {Math.max(1, left)}
        </p>
      )}
      {phase === 'recording' && rec && (
        <>
          <p
            role="status"
            className="text-center font-marker text-3xl text-marker-blue"
          >
            {progress(stage, rec, motion)}
          </p>
          {/* Down where the thumbs rest, like the game's walk pad. */}
          <div className="mt-auto flex flex-col gap-3">
            {stage.ends === 'presses' && (
              <div
                role="button"
                tabIndex={-1}
                onPointerDown={() => touch(false)}
                onPointerUp={() => touch(true)}
                onPointerCancel={() => touch(true)}
                onContextMenu={e => e.preventDefault()}
                className="flex h-48 touch-none items-center justify-center rounded-sketch border-[3px] border-dashed border-ink bg-marker-water/40 font-marker text-3xl select-none [-webkit-touch-callout:none]"
              >
                Press Here
              </div>
            )}
            {stage.ends === 'done' ? (
              <Button
                size="lg"
                className="min-h-28"
                onClick={() => finishRef.current(true)}
              >
                Done
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  recording.current = null
                  setPhase('ready')
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </>
      )}
    </>
  )
}

/** The line under a take in progress: time left, presses, tips or "Recording". */
function progress(stage: SpikeStage, rec: Recording, motion: Motion): string {
  const elapsed = (performance.now() - rec.startedAt) / 1000
  if (stage.ends === 'timer')
    return `${Math.max(0, Math.ceil((stage.seconds ?? 0) - elapsed))}s left`
  if (stage.ends === 'presses')
    return `${Math.min(rec.presses, stage.count)} of ${stage.count} presses`
  if (stage.ends === 'tips') {
    const dipped = motion.tiltY <= -MOTION_DIP_DEGREES ? ', Dipped' : ''
    return `${Math.min(rec.tips.tips, stage.count)} of ${stage.count} tips${dipped}`
  }
  return `Recording, ${Math.floor(elapsed)}s`
}

/** The phone's reading right now, refreshed 10 times a second. */
function Live({ motion }: { motion: Motion }) {
  useNow(100)
  return (
    <p className="font-mono text-base text-ink-soft">
      jolt {motion.jolt.toFixed(2)} m/s², tilt {motion.tiltX.toFixed(0)}°,{' '}
      {motion.tiltY.toFixed(0)}°
    </p>
  )
}

function Results({ takes, onBack }: { takes: SpikeTakes; onBack: () => void }) {
  const [copied, setCopied] = useState('')
  const report = useMemo(() => {
    const suggestions = suggest(takes)
    const next = suggestedNumbers(suggestions)
    const rows = checks(takes, CURRENT_PHONE, next)
    const header = `Water in a Sieve phone spike, ${new Date().toISOString()}\n${navigator.userAgent}`
    const text = readingsText(takes, suggestions, rows, header)
    return { suggestions, next, rows, text }
  }, [takes])

  const copy = () => {
    navigator.clipboard?.writeText(report.text).then(
      () => setCopied('Copied. Paste it to the builder.'),
      () => setCopied('Copying failed. Select the text below instead.')
    )
  }
  const play = () => {
    const tune = encodeURIComponent(tuneValue(report.next))
    location.assign(`/?debug&tune=${tune}`)
  }

  return (
    <>
      <h1 className="-rotate-1 font-marker text-4xl leading-none">Results</h1>
      <p className="text-lg leading-snug">
        These numbers read one phone. Play with them before they go into the
        game.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={copy}>Copy Readings</Button>
        <Button onClick={play}>Play With These</Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
      {copied && (
        <p role="status" className="text-lg text-marker-blue">
          {copied}
        </p>
      )}
      <Panel title="Suggested Numbers">
        <ul className="flex flex-col gap-3">
          {report.suggestions.map(s => (
            <li key={s.name} className="flex flex-col">
              <span className="font-mono text-sm break-all">{s.name}</span>
              <span className="font-marker text-2xl">
                {s.now} → {s.value}
              </span>
              <span className="text-base leading-snug text-ink-soft">
                {s.why}
              </span>
              {s.warning && (
                <span className="text-base leading-snug text-marker-red">
                  {s.warning}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Checks">
        <ul className="flex flex-col gap-3 text-base leading-snug">
          {report.rows.map(row => (
            <li key={row.label} className="grid grid-cols-2 gap-x-3">
              <span className="col-span-2 font-marker">{row.label}</span>
              <Verdict when="Now" value={row.now} ok={row.nowOk} />
              <Verdict when="Suggested" value={row.next} ok={row.nextOk} />
            </li>
          ))}
        </ul>
      </Panel>
      <textarea
        readOnly
        value={report.text}
        aria-label="Readings"
        className="h-64 w-full rounded-sketch border-2 border-ink bg-white/80 p-2 font-mono text-xs"
      />
    </>
  )
}

/** "Now: 0.02 ✓", green when the check passes and red when it fails. */
function Verdict({
  when,
  value,
  ok
}: {
  when: string
  value: string
  ok: boolean | null
}) {
  const tone =
    ok === null ? 'text-ink-soft' : ok ? 'text-marker-green' : 'text-marker-red'
  return (
    <span className={tone}>
      {when}: {value}
      {ok === null ? '' : ok ? ' ✓' : ' ✗'}
    </span>
  )
}
