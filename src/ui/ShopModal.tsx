import { useReducer, type ReactNode } from 'react'

import { JOKE_BUYS, type JokeBlocker, type JokeBuy } from '../game/kit'
import type { Sim } from '../game/sim'
import {
  Button,
  CoinBadge,
  CoinIcon,
  Modal,
  Panel,
  sfx,
  ShopPanel,
  toast,
  useCoins
} from '../shared'

export interface ShopModalProps {
  open: boolean
  sim: Sim
  onClose: () => void
}

/**
 * The shop: upgrades from the shared panel, then joke buys for spare coins. It only
 * opens with an empty sieve, and the game waits while it's open.
 */
export function ShopModal({ open, sim, onClose }: ShopModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Shop"
      footer={
        <Button onClick={onClose} sound={false}>
          Back to the Game
        </Button>
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-lg text-ink-soft">
          Upgrades are yours for good. The game waits while this is open.
        </p>
        <CoinBadge wallet={sim.wallet} className="shrink-0" />
      </div>
      <ShopPanel
        shop={sim.shop}
        title="Upgrades"
        compact
        onBuy={upgrade => sim.bought(upgrade.id)}
      />
      <JokeBuys sim={sim} />
    </Modal>
  )
}

/** Wishes, cat treats and the party hat: nothing useful, and that's the point. */
function JokeBuys({ sim }: { sim: Sim }) {
  const coins = useCoins(sim.wallet)
  // Buying changes game state the wallet doesn't hold, such as the hat.
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const buy = (item: JokeBuy) => {
    const line = sim.buyJoke(item.id)
    if (line === null) {
      sfx.play('fail', { volume: 0.4 })
      return
    }
    sfx.play('coin')
    if (item.id === 'wish') sfx.play('drip', { pitch: 0.5, volume: 0.8 })
    toast(line, item.id === 'wish' ? 'info' : 'coin', 3600)
    refresh()
  }
  return (
    <Panel title="Joke Buys" className="mt-3 flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {JOKE_BUYS.map(item => {
          const blocker = sim.jokeBlocker(item.id)
          return (
            <li
              key={item.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-sketch border-2 border-ink/60 bg-white/60 p-3"
            >
              <span className="font-marker text-xl leading-tight">
                {item.name}
              </span>
              <span className="col-span-2 font-hand text-lg leading-tight">
                {item.blurb}
              </span>
              <Button
                className="col-start-2 row-start-1"
                disabled={blocker !== null}
                sound={false}
                onClick={() => buy(item)}
                aria-label={
                  blocker === null
                    ? `Buy ${item.name} for ${item.cost} coins`
                    : undefined
                }
              >
                {buyLabel(blocker, item.cost - coins, item.cost)}
              </Button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function buyLabel(
  blocker: JokeBlocker | null,
  short: number,
  cost: number
): ReactNode {
  switch (blocker) {
    case 'owned':
      return 'Owned'
    case 'notHere':
      return 'Only at the Well'
    case 'poor':
      return (
        <>
          Need <CoinIcon /> {short} more
        </>
      )
    default:
      return (
        <>
          Buy <CoinIcon /> {cost}
        </>
      )
  }
}
