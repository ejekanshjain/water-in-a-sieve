import { useEffect, useSyncExternalStore } from 'react'

import { blockGameInput } from '../shared'
import { covered, type Game } from '../shell'

/** Phones held sideways: wide, short and touch-driven, so short desktop windows don't match. */
const SIDEWAYS_QUERY =
  '(orientation: landscape) and (max-height: 500px) and (pointer: coarse)'

function subscribe(onChange: () => void): () => void {
  const list = matchMedia(SIDEWAYS_QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

/**
 * Covers the game while a phone is held sideways, which the portrait layout can't fit.
 * The game pauses underneath, so turning the phone never spills the sieve.
 */
export function Sideways({ game }: { game: Game }) {
  const sideways = useSyncExternalStore(
    subscribe,
    () => matchMedia(SIDEWAYS_QUERY).matches,
    () => false
  )
  useEffect(() => {
    if (!sideways) return
    game.sim.pause()
    game.suspendInput()
    game.ui.set({ sideways: true })
    const unblock = blockGameInput()
    return () => {
      unblock()
      game.ui.set({ sideways: false })
      if (!covered(game)) game.sim.resume()
    }
  }, [sideways, game])
  if (!sideways) return null
  return (
    <div
      role="alert"
      className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-paper p-6 text-center text-ink"
    >
      <h2 className="animate-wobble font-marker text-3xl">
        Turn Your Phone Upright
      </h2>
      <p className="max-w-md font-hand text-xl">
        The sieve waits. Rotation lock keeps a flat phone from flipping.
      </p>
    </div>
  )
}
