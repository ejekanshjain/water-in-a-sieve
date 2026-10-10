import type { Sim } from '../game/sim'
import { Button, StartScreen, type MotionPermission } from '../shared'
import { RealWalkToggle } from './RealWalkToggle'

export interface TitleProps {
  sim: Sim
  /** A phone: the rotation lock tip and Walk for Real show. */
  phone: boolean
  onStart: (motion: MotionPermission) => void
  onSettings: () => void
}

/**
 * The start screen over a faint view of the well. The tap unlocks sound, keeps the
 * screen awake and asks for motion access on phones, which also get Walk for Real.
 */
export function Title({ sim, phone, onStart, onSettings }: TitleProps) {
  return (
    <StartScreen
      title="Water in a Sieve"
      pitch="Fill the bathtub. You only have a sieve."
      story="Your water is cut off and you have a job interview tomorrow. The only water left is the well at the bottom of the garden."
      motion
      onStart={info => onStart(info.motion)}
      className="bg-paper/85"
    >
      {phone && (
        <p className="max-w-md font-hand text-lg leading-snug text-balance">
          Tip: turn on rotation lock. A flat phone likes to flip the screen.
        </p>
      )}
      {phone && <RealWalkToggle sim={sim} />}
      <p className="max-w-md font-hand text-lg text-ink-soft">
        Nothing saves. Closing the tab starts you over.
      </p>
      <Button variant="ghost" onClick={onSettings}>
        Settings
      </Button>
    </StartScreen>
  )
}
