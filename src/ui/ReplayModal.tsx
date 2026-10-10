import { useState } from 'react'

import { litres } from '../game/captions'
import { drainSpot } from '../game/replays'
import { REPLAY_SPEED } from '../game/tuning'
import { Button, Modal, ReplayPlayer, ShareModal, useStore } from '../shared'
import { closeModal, shareReplay, type Game } from '../shell'

/**
 * The slow-mo replay of a painful drain, with where it happened as the big label. Watch
 * Again replays it, Share turns it into a fail card, and Skip carries on. The game waits
 * while it shows.
 */
export function ReplayModal({ game }: { game: Game }) {
  const open = useStore(game.ui, s => s.modal === 'replay')
  const shot = useStore(game.ui, s => s.replay)
  const [take, setTake] = useState(0)
  const close = () => closeModal(game)
  return (
    <Modal
      open={open && shot !== null}
      onClose={close}
      title="Slow-Mo Replay"
      footer={
        <>
          <Button variant="ghost" onClick={close} sound={false}>
            Skip
          </Button>
          <Button variant="ghost" onClick={() => setTake(n => n + 1)}>
            Watch Again
          </Button>
          <Button onClick={() => shareReplay(game)}>Share</Button>
        </>
      }
    >
      {shot && (
        <div className="flex flex-col items-center gap-2">
          {/* Above the clip, not on it: you fall over at the bottom of the frame. */}
          <p className="-rotate-2 text-center font-marker text-3xl leading-tight text-marker-red">
            {drainSpot(shot.drain)}
          </p>
          {/* Sized by height too, so the 9:16 clip and the buttons fit a short phone. */}
          <div className="w-[min(100%,24dvh)]">
            <ReplayPlayer
              key={`${shot.id}-${take}`}
              clip={shot.clip}
              speed={REPLAY_SPEED}
            />
          </div>
          <p className="text-center text-xl leading-tight">
            <span className="font-marker">{shot.caption}</span> Trip{' '}
            {shot.drain.trip}. {litres(shot.drain.ml)} gone.
          </p>
        </div>
      )}
    </Modal>
  )
}

/** The share dialog for whatever card the game asked for: a fail, a near miss or a milestone. */
export function ShareDialog({ game }: { game: Game }) {
  const open = useStore(game.ui, s => s.modal === 'share')
  const card = useStore(game.ui, s => s.card)
  const text = useStore(game.ui, s => s.cardText)
  const shame = useStore(game.ui, s => s.shame)
  if (!card) return null
  return (
    <ShareModal
      open={open}
      onClose={() => closeModal(game)}
      card={card}
      text={text}
      title={shame ? 'Share Your Shame' : 'Share This'}
    />
  )
}
