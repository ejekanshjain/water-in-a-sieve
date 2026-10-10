import type { LossCause } from './types'

/** Drain captions per cause, at least 6 each. They rotate so none repeats back to back. */
const DRAIN_LINES: Record<LossCause, readonly string[]> = {
  drip: [
    'Drip. Drip. Gone.',
    'Leaked away. Slowly.',
    'A sieve. What did you expect?',
    'Every drop, one at a time.',
    'It just left.',
    'Holes. Mend them.'
  ],
  jolt: [
    'Gone. All of it.',
    'Steady hands. Not yours.',
    'That was a twitch.',
    'Smooth moves only.',
    'Your hand flinched. The water left.',
    'Jolted. Splashed. Sad.'
  ],
  bump: [
    'Mind the root.',
    'The ground had opinions.',
    'Bump. Splash. Sigh.',
    'Slow down for bumps.',
    'The ring went red. You kept going.',
    'Tripped on a root. Classic.'
  ],
  tilt: [
    'Tipped right out.',
    'Level, not jaunty.',
    'Over the rim it goes.',
    'Flat. Keep it flat.',
    'Gravity wins again.',
    'That was a lean.'
  ],
  letGo: [
    'You let go. Why?',
    'Hands off, water off.',
    'It needed holding.',
    'Keep holding. Always.',
    'Butterfingers.',
    'Never let go. Never.'
  ],
  fly: [
    'A fly. One fly.',
    'Lunch, for the fly.',
    'Blow harder next time.',
    'Beaten by a bug.',
    'It landed. It won.',
    'Bzz. Splash.'
  ],
  leaves: [
    'A leaf. One leaf.',
    'Autumn wins.',
    'Leaf: 1. You: 0.',
    'Blow the leaves away.',
    'One leaf touched it. Gone.',
    'Nature hates you.'
  ],
  sneeze: [
    'Bless you. Not the water.',
    'Gesundheit. Gone.',
    'Achoo. Ach, no.',
    'Freeze for sneezes.',
    'Your nose did this.',
    'Should have held still.'
  ],
  dog: [
    'Good boy. Bad timing.',
    'Stop for the dog.',
    'He just wanted to play.',
    'Woof. Splash.',
    'Tripped by a good boy.',
    'The dog is proud of you.'
  ],
  ring: [
    'Should have declined.',
    'Answer it or decline it.',
    'Your pocket buzzed it away.',
    'Missed call. Missed water.',
    'It went to voicemail. So did the water.',
    "Phones and sieves don't mix."
  ],
  ice: [
    'Ice. Of course.',
    'Slower on the ice.',
    'Your own drain froze.',
    'Winter wins.',
    'Skated. Splashed.',
    'Scrape it next time.'
  ],
  wetFloor: [
    'Your wet floor.',
    'You mopped nothing.',
    'Wipe your spills.',
    'Slipped on your own splash.',
    "Tiptoe when it's wet.",
    'The floor was wet. You knew.'
  ],
  splash: [
    'Too fast. Splash.',
    'Pour gently.',
    'Stay in the green.',
    'Splashed it everywhere.',
    'More on the floor than in.',
    'That was a dump, not a pour.'
  ],
  cat: [
    'The cat. Obviously.',
    'Tripped over the cat.',
    'The cat wins again.',
    'The cat sends its regards.',
    'Stand still for the cat.',
    'It only wanted a cuddle.'
  ],
  swat: [
    'You swatted the water.',
    'Swat. Splash. Oops.',
    "The fly lives. The water doesn't.",
    'Swing gently. Or not at all.',
    'Fly: 1. Swatter: 0.',
    'You hit yourself, basically.'
  ],
  stomp: [
    'Stomp. Splosh.',
    'Gentle feet. Gentle.',
    'The neighbours felt that.',
    "Tiptoe. It's a sieve.",
    'Elephant steps.',
    'Your feet did this.'
  ]
}

/** "Third fly today.": how each cause counts itself. `{n}` becomes "Third". */
const COUNT_LINES: Record<LossCause, string> = {
  drip: '{n} leak today.',
  jolt: '{n} twitch today.',
  bump: '{n} bump today.',
  tilt: '{n} tip-over today.',
  letGo: 'You let go. {n} time today.',
  fly: '{n} fly today.',
  leaves: '{n} leaf today.',
  sneeze: '{n} sneeze today.',
  dog: '{n} time the dog got you.',
  ring: '{n} call today.',
  ice: '{n} skate today.',
  wetFloor: '{n} slip on your own floor.',
  splash: '{n} splash today.',
  cat: '{n} time the cat got you.',
  swat: '{n} self-swat today.',
  stomp: '{n} stomp today.'
}

/** "That's 12 L to the dog.": who or what got the water. */
const LOST_TO: Record<LossCause, string> = {
  drip: 'drips',
  jolt: 'your twitchy hands',
  bump: 'bumps',
  tilt: 'tilting',
  letGo: 'letting go',
  fly: 'flies',
  leaves: 'leaves',
  sneeze: 'sneezes',
  dog: 'the dog',
  ring: 'phone calls',
  ice: 'ice',
  wetFloor: 'your own floor',
  splash: 'splashes',
  cat: 'the cat',
  swat: 'your own swatter',
  stomp: 'your own feet'
}

const ORDINALS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth'
]

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine'
]

/** What a caption may quote about a drain. */
export interface DrainFacts {
  /** Drains of this cause before this one. */
  count: number
  /** Water lost to this cause so far, this drain included. */
  lostMl: number
  /** Metres along the path when it drained on the path, otherwise null. */
  pathMetres: number | null
}

/** Litres lost to one cause before "That's 12 L to the dog." is worth saying. */
const QUOTE_LITRES_ML = 2000

/**
 * Picks a drain caption. Most drains rotate through the cause's own lines by `count`, so
 * none repeats back to back. Every third drain of a cause quotes your stats instead
 * ("Third fly today.", "That's 12 L to the dog."), and a drain in the first 10 m mocks
 * the distance ("8 m. Eight.") every other time.
 */
export function drainCaption(cause: LossCause, facts: DrainFacts): string {
  const { count, lostMl, pathMetres } = facts
  const metres = pathMetres === null ? -1 : Math.floor(pathMetres)
  if (metres >= 1 && metres < 10 && count % 2 === 0)
    return `${metres} m. ${NUMBER_WORDS[metres]}.`
  if (count % 3 === 2) {
    // Alternate between counting and adding up, once there's enough to add up.
    if (lostMl >= QUOTE_LITRES_ML && count % 6 === 5)
      return `That's ${litres(lostMl)} to ${LOST_TO[cause]}.`
    return COUNT_LINES[cause].replace('{n}', ordinal(count + 1))
  }
  // Skip the slots the stat lines took, so every line in the list gets its turn.
  const lines = DRAIN_LINES[cause]
  const index = count - Math.floor((count + 1) / 3)
  return lines[index % lines.length] ?? 'Gone.'
}

/** "Third", or "11th" past ten. */
function ordinal(n: number): string {
  const word = ORDINALS[n - 1]
  if (word) return word
  const tens = n % 100
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th'
  return `${n}${suffix}`
}

/** Every caption a cause can get from its own list, for tests. */
export function drainLines(cause: LossCause): readonly string[] {
  return DRAIN_LINES[cause]
}

/** "0.8 L" style litres: one decimal under 10 L, no trailing ".0". */
export function litres(ml: number): string {
  const l = ml / 1000
  if (l >= 10) return `${Math.round(l)} L`
  const text = (Math.round(l * 10) / 10).toFixed(1)
  return `${text.endsWith('.0') ? text.slice(0, -2) : text} L`
}
