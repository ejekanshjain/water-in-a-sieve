import { inRose, nextBumpAhead, nextPatchAhead, nextRoseAhead } from './path'
import type { GameState } from './sim'
import { stonePrompt } from './stones'
import { FATIGUE_START_S, WARN_AHEAD_M } from './tuning'
import type { InputMode } from './types'

/** First-time hints shipped so far. Each shows once, until its action is done. */
export type HintId =
  | 'crank'
  | 'scoop'
  | 'walk'
  | 'walkBack'
  | 'refill'
  | 'frog'
  | 'noDrip'
  | 'pour'
  | 'bump'
  | 'wet'
  | 'drift'
  | 'fatigue'
  | 'rose'
  | 'hole'
  | 'thread'
  | 'sew'
  | 'glue'
  | 'wipe'
  | 'ice'
  | 'leaves'
  | 'leaf'
  | 'cat'
  | 'plug'
  | 'fly'
  | 'sneeze'
  | 'dog'
  | 'ring'
  | 'shop'
  | 'rewax'
  | 'slippers'
  | 'swatter'
  | 'stone'
  | 'catAnkles'
  | 'bathroom'
  /** Last Trip on a phone: the context slot offers Walk for Real. */
  | 'realWalk'
  /** The first carry walking for real. */
  | 'realSteps'

export type HintsDone = Record<HintId, boolean>

export function createHintsDone(): HintsDone {
  return {
    crank: false,
    scoop: false,
    walk: false,
    walkBack: false,
    refill: false,
    frog: false,
    noDrip: false,
    pour: false,
    bump: false,
    wet: false,
    drift: false,
    fatigue: false,
    rose: false,
    hole: false,
    thread: false,
    sew: false,
    glue: false,
    wipe: false,
    ice: false,
    leaves: false,
    leaf: false,
    cat: false,
    plug: false,
    fly: false,
    sneeze: false,
    dog: false,
    ring: false,
    shop: false,
    rewax: false,
    slippers: false,
    swatter: false,
    stone: false,
    catAnkles: false,
    bathroom: false,
    realWalk: false,
    realSteps: false
  }
}

/**
 * Hint copy per input: mouse and keys, two thumbs, the phone as the sieve, and walking
 * for real with it.
 */
const TEXT: Record<
  HintId,
  { mouse: string; touch: string; motion?: string; real?: string }
> = {
  crank: {
    mouse: "Draw slow circles on the crank. Don't let go.",
    touch: "Draw slow circles on the crank. Don't let go."
  },
  scoop: {
    mouse: 'Grab the sieve. Dip it. Hold. Lift slowly.',
    touch: 'Hold the sieve. Dip it. Hold. Lift slowly.',
    motion: 'Tip the phone forward to dip. Tip it back slowly.'
  },
  walk: {
    mouse: 'Keep holding. Hold W to walk.',
    touch: 'Keep holding. Hold the walk pad to walk.',
    motion: 'Keep the phone flat. Hold a thumb down to walk.'
  },
  walkBack: {
    mouse: 'Nothing to spill. Run.',
    touch: 'Nothing to spill. Hold the pad and run.',
    motion: 'Nothing to spill. Hold a thumb down and run.',
    real: 'Nothing to spill. Walk back, or hold a thumb down.'
  },
  refill: {
    mouse: 'The well needs 1 min. Do a chore.',
    touch: 'The well needs 1 min. Do a chore.'
  },
  frog: {
    mouse: 'A frog. On your crank. Move it.',
    touch: 'A frog. On your crank. Move it.'
  },
  noDrip: {
    mouse: 'No drips this trip earns a bonus.',
    touch: 'No drips this trip earns a bonus.'
  },
  pour: {
    mouse: 'Move right, or hold D, to pour. Stay in the green.',
    touch: 'Drag right to pour. Stay in the green.',
    motion: 'Tilt the phone right to pour. Stay in the green.'
  },
  bump: {
    mouse: 'Bump ahead. Watch the ring. Slow down.',
    touch: 'Bump ahead. Watch the ring. Slow down.'
  },
  wet: {
    mouse: 'Wet. Tiptoe across.',
    touch: 'Wet. Tiptoe across.'
  },
  drift: {
    mouse: 'The sieve wanders. Keep it on the dot.',
    touch: 'The sieve wanders. Keep it on the dot.',
    motion: 'Your arms wander. Keep the sieve on the dot.'
  },
  fatigue: {
    mouse: 'Arms. Going. Hurry up.',
    touch: 'Arms. Going. Hurry up.'
  },
  rose: {
    mouse: 'Thorns. Walk past slowly.',
    touch: 'Thorns. Walk past slowly.'
  },
  hole: {
    mouse: 'A hole. Click the sieve to mend it at the bench.',
    touch: 'A hole. Tap the sieve to mend it at the bench.'
  },
  thread: {
    mouse: 'Drag the thread into the eye. Wait for the sway.',
    touch: 'Drag the thread into the eye. Wait for the sway.'
  },
  sew: {
    mouse: 'Stitch the dots in order.',
    touch: 'Stitch the dots in order.'
  },
  glue: {
    mouse: 'Glue dries in 1 min. Do a chore.',
    touch: 'Glue dries in 1 min. Do a chore.'
  },
  wipe: {
    mouse: 'Stop on it and rub to wipe.',
    touch: 'Stop on it and rub to wipe.'
  },
  ice: {
    mouse: 'Ice. Slower still.',
    touch: 'Ice. Slower still.'
  },
  leaves: {
    mouse: 'Leaves. Drag them out first.',
    touch: 'Leaves. Drag them out first.'
  },
  leaf: {
    mouse: 'A leaf. Hold F to blow it off.',
    touch: 'A leaf. Hold a finger on it to blow.'
  },
  cat: {
    mouse: "The cat's drinking your water. Go shoo it.",
    touch: "The cat's drinking your water. Go shoo it."
  },
  plug: {
    mouse: 'Gurgle. Check the plug.',
    touch: 'Gurgle. Check the plug.'
  },
  fly: {
    mouse: 'A fly. Hold F to blow it away.',
    touch: 'A fly. Hold a finger on it to blow.'
  },
  dog: {
    mouse: 'Woof. Stop and let it pass.',
    touch: 'Woof. Lift your thumb and let it pass.',
    real: 'Woof. Stand still and let it pass.'
  },
  ring: {
    mouse: 'E answers. F declines.',
    touch: 'Answer or Decline, down below.'
  },
  shop: {
    mouse: 'Coins buy upgrades. Shop with an empty sieve.',
    touch: 'Coins buy upgrades. Tap your coins to shop.'
  },
  rewax: {
    mouse: 'Wax wore off. Click the wax tin to rub it back on.',
    touch: 'Wax wore off. Tap the wax tin to rub it back on.'
  },
  slippers: {
    mouse: 'Soggy slippers. Click the washing line to dry them.',
    touch: 'Soggy slippers. Tap the washing line to dry them.'
  },
  catAnkles: {
    mouse: 'The cat. Let go of W. Let it weave.',
    touch: 'The cat. Lift your thumb. Let it weave.',
    real: 'The cat. Stand still. Let it weave.'
  },
  bathroom: {
    mouse: 'It followed you in. Hold still.',
    touch: 'It followed you in. Hold still.'
  },
  stone: {
    mouse: 'Stop here to lay a stone.',
    touch: 'Stop here to lay a stone.'
  },
  swatter: {
    mouse: 'R swats. It shakes the sieve.',
    touch: 'Tap Swat. It shakes the sieve.'
  },
  sneeze: {
    mouse: 'Ah… ah… Stop walking. Hold still.',
    touch: 'Ah… ah… Lift your thumb. Hold still.',
    motion: 'Ah… ah… Lift your thumb. Keep the phone still.',
    real: 'Ah… ah… Stop walking. Keep the phone still.'
  },
  realWalk: {
    mouse: 'Last trip. Walk it for real? Tap Walk for Real.',
    touch: 'Last trip. Walk it for real? Tap Walk for Real.'
  },
  realSteps: {
    mouse: 'Walk for real. Small, gentle steps.',
    touch: 'Walk for real. Small, gentle steps.'
  }
}

/** Another input took over mid-carry: how to take hold with it. */
const SWITCHED: Record<InputMode, string> = {
  mouse: 'A mouse or pen took over. Press and hold to grab the sieve.',
  touch: 'Your thumbs took over. Press and hold to grab the sieve.',
  motion: 'Tilt took over. Hold the phone level and tap to carry on.'
}

/** The Rewax hint while some wax is left: the director asks early, during a wait. */
const REWAX_SOON = {
  mouse: 'Wax wearing thin. Click the wax tin to top it up.',
  touch: 'Wax wearing thin. Tap the wax tin to top it up.'
}

function text(id: HintId, mode: InputMode, real = false): string {
  const copy = TEXT[id]
  if (mode === 'mouse') return copy.mouse
  if (mode !== 'motion') return copy.touch
  return (real ? copy.real : undefined) ?? copy.motion ?? copy.touch
}

/** True when an ice patch lies within warning range ahead of the carry. */
function iceAhead(state: GameState): boolean {
  const at = state.walker.distance
  return state.path.patches.some(
    p => p.kind === 'ice' && p.at > at && p.at - at <= WARN_AHEAD_M
  )
}

/** In the house with an empty sieve: what there is to do, and how to leave. */
function visitLine(state: GameState, mode: InputMode): string {
  const leave =
    mode === 'mouse'
      ? 'hold W'
      : mode === 'touch'
        ? 'hold the walk pad'
        : state.realWalk.active
          ? 'take a step'
          : 'hold a thumb down'
  if (state.cat.mood === 'drinking')
    return mode === 'mouse'
      ? 'Click the cat to shoo it.'
      : 'Tap the cat to shoo it.'
  if (state.cat.plugOut) return 'Drag the plug back into the hole.'
  if (state.house.floorPatch) return `Rub the puddle dry, or ${leave} to leave.`
  return `All done here. ${leave.charAt(0).toUpperCase()}${leave.slice(1)} to go back.`
}

/** What the hint line needs beyond the state: chores and the shop are the sim's. */
export interface HintContext {
  /** Water is in your hands. */
  atStake?: boolean
  /** The Rewax chore is open. */
  rewaxOpen?: boolean
  /** The shop would open here, and you can afford its cheapest upgrade. */
  canShop?: boolean
  /** The context slot offers Walk for Real. */
  offerRealWalk?: boolean
}

/**
 * The line to show now: pause and resume messages first, then the first unfinished
 * first-time hint that fits the moment.
 */
export function hintFor(
  state: GameState,
  mode: InputMode,
  {
    atStake = false,
    rewaxOpen = false,
    canShop = false,
    offerRealWalk = false
  }: HintContext = {}
): string | null {
  const real = state.realWalk.active
  if (state.paused) {
    if (atStake && state.inputSwitched) return SWITCHED[mode]
    if (atStake && mode === 'motion')
      return 'Paused. Hold the phone level and tap to carry on.'
    if (atStake) return 'Paused. Grab the sieve to carry on.'
    return mode === 'mouse'
      ? 'Paused. Click to carry on.'
      : 'Paused. Tap to carry on.'
  }
  if (state.scene === 'cutscene') return null
  if (state.holdStillMs > 0) return 'Hold still…'
  const done = state.hintsDone
  const well = state.well
  if (state.scene === 'well' && state.bench.open) {
    if (state.bench.mode === 'wax') return 'Rub back and forth to wax the mesh.'
    if (!state.bench.threaded)
      return done.thread ? null : text('thread', mode, real)
    const sewing = state.holes.some(h => h.stitched < h.points)
    if (sewing) return done.sew ? null : text('sew', mode, real)
    return mode === 'mouse'
      ? 'Click the glue to seal the stitches.'
      : 'Tap the glue to seal the stitches.'
  }
  if (state.scene === 'well') {
    if (state.holes.length > 0 && !done.hole) return text('hole', mode, real)
    if (state.waits.glue && !done.glue) return text('glue', mode, real)
    if (well.frog !== 'none' && !done.frog) return text('frog', mode, real)
    if (well.leaves.length > 0 && !done.leaves)
      return text('leaves', mode, real)
    if (state.cat.mood === 'drinking' && !done.cat)
      return text('cat', mode, real)
    if (state.cat.plugOut && !done.plug) return text('plug', mode, real)
    if (state.kit.slippers === 'soaked' && !done.slippers)
      return text('slippers', mode, real)
    if (rewaxOpen && !done.rewax)
      return state.gear.wax
        ? REWAX_SOON[mode === 'mouse' ? 'mouse' : 'touch']
        : text('rewax', mode, real)
    if (state.waits.refill && !done.refill) return text('refill', mode, real)
    if (state.phase === 'crank' && !done.crank) return text('crank', mode, real)
    if (state.phase === 'scoop' && !done.scoop) return text('scoop', mode, real)
    if (offerRealWalk) return text('realWalk', mode, real)
    if (canShop && !done.shop) return text('shop', mode, real)
    return null
  }
  if (state.scene === 'house' && state.phase === 'visit')
    return visitLine(state, mode)
  if (state.scene === 'walkBack' && !done.wipe) {
    if (state.wipe) return 'Rub back and forth to wipe it.'
    if (state.promptPatch >= 0) return text('wipe', mode, real)
  }
  if (state.scene === 'walkBack' && state.stone.segment >= 0) {
    if (state.stone.placing) return 'Drag the stone into the gap.'
    if (!done.stone && stonePrompt(state)) return text('stone', mode, real)
  }
  // Each carry event teaches itself the first time it warns you, then the swatter. The
  // first threat to follow you indoors says so.
  const event = state.event
  if (event?.stage === 'warning') {
    if (event.bathroom && !done.bathroom && done[event.id])
      return text('bathroom', mode, real)
    if (!done[event.id]) return text(event.id, mode, real)
    const swattable = event.id === 'fly' || event.id === 'leaf'
    if (swattable && state.kit.swatter && !done.swatter)
      return text('swatter', mode, real)
  }
  if (state.phase === 'carry' && !done.ice && iceAhead(state))
    return text('ice', mode, real)
  const walking =
    state.phase === 'carry' ||
    state.phase === 'return' ||
    state.phase === 'toHouse'
  if (walking) {
    const dir = state.walker.dir
    const at = state.walker.distance
    if (!done.wet && nextPatchAhead(state.path, at, dir) <= WARN_AHEAD_M)
      return text('wet', mode, real)
  }
  if (state.scene === 'path' && state.phase === 'carry') {
    const bumpIn = nextBumpAhead(state.path, state.walker.distance)
    if (!done.bump && bumpIn <= WARN_AHEAD_M) return text('bump', mode, real)
    const at = state.walker.distance
    const thorns =
      nextRoseAhead(state.path, at) <= WARN_AHEAD_M || inRose(state.path, at)
    if (!done.rose && thorns) return text('rose', mode, real)
    if (real && !done.realSteps) return text('realSteps', mode, real)
    if (!done.walk && !real) return text('walk', mode, real)
    if (!done.fatigue && state.carryMs >= FATIGUE_START_S * 1000)
      return text('fatigue', mode, real)
    if (!done.drift && state.trip > 1) return text('drift', mode, real)
    if (state.current.noDrip === 'intact' && !done.noDrip)
      return text('noDrip', mode, real)
    if (offerRealWalk) return text('realWalk', mode, real)
  }
  if (state.scene === 'house' && state.phase === 'pour' && !done.pour)
    return text('pour', mode, real)
  if (state.scene === 'walkBack' && !done.walkBack)
    return text('walkBack', mode, real)
  return null
}
