import { useEffect, useRef } from 'react'

import type { PhoneTilt } from '../scenes/motion'
import { Button, useNow } from '../shared'

export interface TrayStepProps {
  tilt: PhoneTilt
  /** You chose Walk for Real on the start screen. */
  realWalk: boolean
  /** Calibrated: the phone is the sieve from now on. */
  onDone: () => void
  /** Skips motion: two thumbs hold and walk instead. */
  onThumbs: () => void
}

/** Without sensor data after this long, the phone has no usable motion sensor. */
const NO_DATA_MS = 2000

/**
 * "Hold It Like a Tray": waits until the phone is held still within 45° of flat, then
 * treats that pose as level. The game loop steps the calibration; this screen polls it.
 */
export function TrayStep({ tilt, realWalk, onDone, onThumbs }: TrayStepProps) {
  const now = useNow(150)
  const startedAt = useRef(now)
  const done = tilt.calibrated
  useEffect(() => {
    tilt.request('tray')
    return () => tilt.cancel()
  }, [tilt])
  useEffect(() => {
    if (done) onDone()
  }, [done, onDone])

  const noSensor =
    tilt.status === 'noData' && now - startedAt.current > NO_DATA_MS
  const status = noSensor
    ? 'No motion sensor found. Your thumbs can hold the sieve instead.'
    : tilt.status === 'flatter'
      ? 'Hold it flatter.'
      : tilt.status === 'noData'
        ? 'Waiting for the motion sensor…'
        : 'Now hold still…'
  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-5 bg-paper/90 px-6 py-8 text-center text-ink">
      <h1 className="max-w-md -rotate-2 font-marker text-4xl leading-none text-balance">
        Hold It Like a Tray
      </h1>
      <p className="max-w-md font-hand text-2xl leading-tight text-balance">
        Your phone is the sieve. Hold it flat in front of you, screen up.
      </p>
      {realWalk && (
        <p className="max-w-md font-hand text-xl leading-tight text-balance">
          Then walk for real. Clear a path first.
        </p>
      )}
      <p
        role="status"
        className="min-h-8 max-w-md font-marker text-2xl text-marker-blue"
      >
        {status}
      </p>
      {noSensor ? (
        <Button size="lg" onClick={onThumbs}>
          Use Thumbs
        </Button>
      ) : (
        <Button variant="ghost" onClick={onThumbs}>
          Use Thumbs Instead
        </Button>
      )}
    </div>
  )
}
