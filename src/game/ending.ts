import { formatClock, type ShareStat } from '../shared'
import { litres } from './captions'
import type { ContainerLedger } from './containers'
import { GAME_NAME, type CardText } from './share'
import type { LossCause } from './types'

/** The numbers on the ending screen, built once when the tub fills. */
export interface EndingStats {
  /** Wall-clock time from the start tap to the full tub. */
  playedMs: number
  trips: number
  scoopedMl: number
  /** Everything scooped that never stayed: the sieve's losses, the cat's and the plug's. */
  lostMl: number
  /** What cost you the most water, such as "Drips", and how much. */
  topCause: string
  topCauseMl: number
  fliesBlown: number
  coins: number
  /** Your latest interview answer, or null if you never gave one. */
  answer: string | null
  /** The interviewer got through and asked you something, answered or not. */
  asked: boolean
}

/** What the ending calls each cause of lost water. */
const CAUSE_NAME: Record<LossCause | 'catDrink' | 'plug', string> = {
  drip: 'Drips',
  jolt: 'Shaky hands',
  bump: 'Bumps',
  tilt: 'Tilting',
  letGo: 'Letting go',
  fly: 'Flies',
  leaves: 'Leaves',
  sneeze: 'Sneezes',
  dog: 'The dog',
  ring: 'Phone calls',
  ice: 'Ice',
  wetFloor: 'Wet floors',
  splash: 'Splashes',
  swat: 'Your swatter',
  cat: 'The cat',
  stomp: 'Stomping',
  catDrink: 'The cat',
  plug: 'The plug'
}

export interface EndingInput {
  playedMs: number
  trips: number
  scoopedMl: number
  lostByCause: Readonly<Record<LossCause, number>>
  containers: readonly ContainerLedger[]
  fliesBlown: number
  coins: number
  answer: string | null
  asked: boolean
}

/**
 * Totals for the ending screen. The cat counts once, for drinking your water and for
 * tripping you up; the plug counts on its own.
 */
export function endingStats(input: EndingInput): EndingStats {
  const byName = new Map<string, number>()
  const add = (name: string, ml: number) => {
    if (ml > 0) byName.set(name, (byName.get(name) ?? 0) + ml)
  }
  let lostMl = 0
  for (const [cause, ml] of Object.entries(input.lostByCause)) {
    add(CAUSE_NAME[cause as LossCause], ml)
    lostMl += ml
  }
  for (const ledger of input.containers) {
    add(CAUSE_NAME.catDrink, ledger.catDrunk)
    add(CAUSE_NAME.plug, ledger.plugDrained)
    lostMl += ledger.catDrunk + ledger.plugDrained
  }
  let topCause = 'Nothing'
  let topCauseMl = 0
  for (const [name, ml] of byName) {
    if (ml <= topCauseMl) continue
    topCause = name
    topCauseMl = ml
  }
  return {
    playedMs: input.playedMs,
    trips: input.trips,
    scoopedMl: input.scoopedMl,
    lostMl,
    topCause,
    topCauseMl,
    fliesBlown: input.fliesBlown,
    coins: input.coins,
    answer: input.answer,
    asked: input.asked
  }
}

/** The ending screen's rows, in order. */
export function endingRows(stats: EndingStats): ShareStat[] {
  return [
    { label: 'Time', value: formatClock(stats.playedMs) },
    { label: 'Trips', value: stats.trips },
    { label: 'Litres Scooped', value: litres(stats.scoopedMl) },
    { label: 'Litres Lost', value: litres(stats.lostMl) },
    { label: 'Top Cause', value: topCauseText(stats) },
    { label: 'Flies Blown Away', value: stats.fliesBlown },
    { label: 'Coins Left Over', value: stats.coins },
    {
      label: 'Your Interview Answer',
      value: stats.answer
        ? `"${stats.answer}"`
        : stats.asked
          ? 'Said nothing'
          : 'Never picked up'
    }
  ]
}

function topCauseText(stats: EndingStats): string {
  return stats.topCauseMl > 0
    ? `${stats.topCause}, ${litres(stats.topCauseMl)}`
    : 'Nothing'
}

/** The ending card: four numbers over the bathtub. */
export function endingCard(stats: EndingStats): CardText {
  const title = 'I Filled a Bathtub With a Sieve'
  return {
    title,
    stats: [
      { label: 'Time', value: formatClock(stats.playedMs) },
      { label: 'Trips', value: stats.trips },
      { label: 'Litres Lost', value: litres(stats.lostMl) },
      { label: 'Top Cause', value: stats.topCause }
    ],
    footer: 'The water came back on. The interview was last year.',
    text: `I filled a bathtub with a sieve in ${formatClock(stats.playedMs)}. ${GAME_NAME}. #WaterInASieve`
  }
}
