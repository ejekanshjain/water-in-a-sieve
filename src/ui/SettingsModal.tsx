import type { Sim } from '../game/sim'
import type { PhoneTilt } from '../scenes/motion'
import { Button, Modal, SettingsPanel, toast } from '../shared'
import { RealWalkToggle } from './RealWalkToggle'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
  /** The phone as the sieve, for Recalibrate Tilt. */
  tilt: PhoneTilt
  /** For Walk for Real. */
  sim: Sim
  /**
   * Walk for Real shows on phones: 'ready' when real steps can count, 'noSensor' when the
   * phone sends no motion data, null on desktop.
   */
  realWalk: 'ready' | 'noSensor' | null
  /** False on the title screen, where there is nothing to pause yet. */
  started: boolean
}

/**
 * Settings, which double as the pause menu. The game waits while it is open. Phones also
 * get Walk for Real.
 */
export function SettingsModal({
  open,
  onClose,
  tilt,
  sim,
  realWalk,
  started
}: SettingsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      footer={
        <Button onClick={onClose} sound={false}>
          {started ? 'Resume' : 'Done'}
        </Button>
      }
    >
      {started && (
        <p className="mb-3 text-lg text-ink-soft">
          The game waits while this is open.
        </p>
      )}
      <SettingsPanel
        extra={
          <>
            <Recalibrate tilt={tilt} />
            {realWalk && (
              <RealWalkToggle sim={sim} available={realWalk === 'ready'} />
            )}
          </>
        }
      />
    </Modal>
  )
}

/**
 * Treats the phone's current angle as level, which also turns on phone tilt after
 * choosing thumbs. Poses more than 45° from flat are refused.
 */
function Recalibrate({ tilt }: { tilt: PhoneTilt }) {
  const available = tilt.source?.available ?? false
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        disabled={!available}
        onClick={() => {
          if (tilt.calibrateNow())
            toast('Tilt reset. This angle counts as level now.', 'good')
          else toast('Hold it flatter, then tap again.', 'bad')
        }}
      >
        Recalibrate Tilt
      </Button>
      <p className="text-base text-ink-soft">
        {available
          ? 'Hold the phone the way you carry the sieve, then tap.'
          : 'No tilt sensor found. Your thumbs or the mouse hold the sieve.'}
      </p>
    </div>
  )
}
