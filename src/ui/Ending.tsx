import { endingCard, endingRows } from '../game/ending'
import { GAME_NAME } from '../game/share'
import { EndingScreen, useStore } from '../shared'
import type { Game } from '../shell'

/**
 * The ending screen over the cutscene's last frame, once the bathtub is full: your
 * numbers, Share with the ending card over the bathtub still, and Play Again.
 */
export function Ending({ game }: { game: Game }) {
  const stats = useStore(game.hud, s => s.ending)
  if (!stats) return null
  const { text, ...words } = endingCard(stats)
  const card = {
    game: GAME_NAME,
    ...words,
    // Read when the card is drawn: the bathtub still can land after this screen renders.
    get image() {
      return game.shots.moment ?? undefined
    }
  }
  return (
    <EndingScreen
      title="You Filled the Bathtub"
      stats={endingRows(stats)}
      // A full tub is a win, so its share dialog brags instead of saying "Share Your Shame".
      share={{ card, text, title: 'Share Your Bath' }}
    >
      <p>
        The water came back on the second you sat down. The interview was last
        year. You still have the sieve.
      </p>
    </EndingScreen>
  )
}
