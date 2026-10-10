import { formatClock, type ShareStat } from '../shared'
import { litres } from './captions'
import { drainSpot, type DrainRecord } from './replays'
import type { LossCause } from './types'

/** The game's name at the top of every card. */
export const GAME_NAME = 'Water in a Sieve'

/**
 * Something worth a share card on this walk back: the drain that ended the trip, a Last
 * Trip that fell short, or a bathtub milestone.
 */
export type ShareMoment =
  | { kind: 'fail' }
  | { kind: 'nearMiss'; trip: number; shortMl: number; tubMl: number }
  | { kind: 'milestone'; trip: number; line: string; tubMl: number }

export type ShareKind = ShareMoment['kind']

/** A share card's words. The UI adds the picture. */
export interface CardText {
  title: string
  stats: ShareStat[]
  footer: string
  /** The message sent along with the picture. */
  text: string
}

/** How each cause finishes "Trip 41: lost 3 L …". */
const CAUSE_PHRASE: Record<LossCause, string> = {
  drip: 'to drips',
  jolt: 'to shaky hands',
  bump: 'to a bump',
  tilt: 'to a tilt',
  letGo: 'by letting go',
  fly: 'to a fly',
  leaves: 'to a leaf',
  sneeze: 'to a sneeze',
  dog: 'to the dog',
  ring: 'to a phone call',
  ice: 'to ice',
  wetFloor: 'to a wet floor',
  splash: 'to a splash',
  swat: 'to my own swatter',
  cat: 'to the cat',
  stomp: 'to a stomp'
}

/** "Trip 41: lost 3 L to a fly". */
export function failTitle(trip: number, ml: number, cause: LossCause): string {
  return `Trip ${trip}: lost ${litres(ml)} ${CAUSE_PHRASE[cause]}`
}

/** The text sent with a card. */
function message(title: string): string {
  const line = /[.!]$/.test(title) ? title : `${title}.`
  return `${line} #WaterInASieve`
}

/** The fail card: the drain's title, where it happened, and what you've lost so far. */
export function failCard(drain: DrainRecord, totalLostMl: number): CardText {
  const title = failTitle(drain.trip, drain.ml, drain.cause)
  return {
    title,
    stats: [
      { label: 'Trip', value: drain.trip },
      {
        label: 'Distance',
        value: `${Math.floor(Math.min(drain.distance, 100))} m`
      },
      { label: 'Litres Lost', value: litres(drain.ml) },
      { label: 'Total Lost', value: litres(totalLostMl) }
    ],
    footer: `${drainSpot(drain)}.`,
    text: message(title)
  }
}

/** The near-miss card: "Trip 107: 0.2 L short." */
export function nearMissCard(
  moment: Extract<ShareMoment, { kind: 'nearMiss' }>,
  totalLostMl: number
): CardText {
  const title = `Trip ${moment.trip}: ${litres(moment.shortMl)} short.`
  return {
    title,
    stats: [
      { label: 'Trip', value: moment.trip },
      { label: 'In the Tub', value: tubLitres(moment.tubMl) },
      { label: 'Short By', value: litres(moment.shortMl) },
      { label: 'Total Lost', value: litres(totalLostMl) }
    ],
    footer: 'So close. Back to the well.',
    text: message(title)
  }
}

/** A bathtub milestone card, titled with the gag's own line. */
export function milestoneCard(
  moment: Extract<ShareMoment, { kind: 'milestone' }>,
  totalLostMl: number,
  playedMs: number
): CardText {
  return {
    title: moment.line,
    stats: [
      { label: 'Trip', value: moment.trip },
      { label: 'In the Tub', value: tubLitres(moment.tubMl) },
      { label: 'Total Lost', value: litres(totalLostMl) },
      { label: 'Time', value: formatClock(playedMs) }
    ],
    footer: 'Fill the bathtub. You only have a sieve.',
    text: message(moment.line)
  }
}

/** Tub litres with one decimal, so 99.8 never rounds up to 100. */
function tubLitres(ml: number): string {
  return `${(Math.floor(ml / 100) / 10).toFixed(1)} L`
}
