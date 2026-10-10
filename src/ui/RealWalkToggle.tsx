import { useState } from 'react'

import type { Sim } from '../game/sim'
import { Button } from '../shared'

export interface RealWalkToggleProps {
  sim: Sim
  /** False when the phone sends no motion data, so real steps can't count. */
  available?: boolean
}

/**
 * Turns Walk for Real on or off: your real steps walk you while the phone is the sieve.
 * Shown on the start screen and in Settings on phones.
 */
export function RealWalkToggle({ sim, available = true }: RealWalkToggleProps) {
  const [on, setOn] = useState(sim.state.realWalk.on)
  const toggle = () => {
    sim.setWalkForReal(!on)
    setOn(!on)
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant={on ? 'primary' : 'ghost'}
        aria-pressed={on}
        disabled={!available}
        onClick={toggle}
      >
        Walk for Real: {on ? 'On' : 'Off'}
      </Button>
      <p className="max-w-sm text-base leading-snug text-balance text-ink-soft">
        {available
          ? 'Your real steps walk you, about 50 a trip. Step gently. Stomps spill.'
          : 'Needs the motion sensor. Thumbs walk you instead.'}
      </p>
    </div>
  )
}
