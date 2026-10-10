/** Shared game types. Pure data, no behaviour. */

export type SceneId = 'well' | 'path' | 'house' | 'walkBack' | 'cutscene'

/**
 * What the current scene is doing. Well: `crank` (raise the bucket), `scoop` (dip and
 * lift), `idle` (waiting on the refill or a chore). Path: `carry`, then `drained` while
 * the result shows. House: `enter` (the walk-in), `pour`, then `poured` or `drained`.
 * Walk back: `return`. Cutscene: one phase per cutscene, such as `coldOpen`.
 */
export type Phase =
  | 'crank'
  | 'scoop'
  | 'idle'
  | 'bench'
  | 'carry'
  | 'drained'
  | 'enter'
  | 'pour'
  | 'poured'
  | 'return'
  | 'toHouse'
  | 'visit'
  | CutsceneId

/**
 * Cutscenes: the cold open, one per container you fill, and the bathtub milestone gags
 * (the duck floats at 25 L, the cat tests the water at 50 L, the interviewer reschedules
 * at 75 L). Filling the bathtub plays the `ending`.
 */
export type CutsceneId =
  | 'coldOpen'
  | 'bucketDone'
  | 'sinkDone'
  | 'duck'
  | 'catTest'
  | 'reschedule'
  | 'ending'

/** Seasons follow progress: summer with the bucket, autumn with the sink, then the tub. */
export type Season = 'summer' | 'autumn' | 'winter' | 'spring'

/** Why water left the sieve, for stats, captions and share cards. */
export type LossCause =
  | 'drip'
  | 'jolt'
  | 'bump'
  | 'tilt'
  | 'letGo'
  | 'fly'
  | 'leaves'
  | 'sneeze'
  | 'dog'
  | 'ring'
  | 'ice'
  | 'wetFloor'
  | 'splash'
  /** You swung the fly swatter too hard. */
  | 'swat'
  /** You walked into the cat weaving round your ankles. */
  | 'cat'
  /** Walk for Real: a real step landed too hard. */
  | 'stomp'

/** Which input set the player is using. */
export type InputMode = 'mouse' | 'motion' | 'touch'

/** A grip release, classified before the sim sees it. Pauses never tip the sieve. */
export type ReleaseKind = 'none' | 'letGo' | 'pause'

/** One step of player input, built by the input layer or the autopilot. */
export interface InputFrame {
  mode: InputMode
  /** A grip pointer or Space is held, or motion mode is calibrated. */
  grip: boolean
  /** Pointer id of the grip; -1 for Space, motion or none. */
  gripId: number
  /** A fresh grip press since the last step. */
  gripPressed: boolean
  /** A classified grip release since the last step. */
  release: ReleaseKind
  /** Grip position in logical units. */
  x: number
  y: number
  /** Hand acceleration in units/s², measured at the last rendered frame. */
  handAccel: number
  /** Device jolt in m/s² after touch grace. */
  motionJolt: number
  /** Device tilt in degrees from the calibrated pose. */
  tiltX: number
  tiltY: number
  walk: boolean
  /** Pour axis value, 0 to 1. */
  pour: number
  blow: boolean
  /** Pressed this step. */
  swat: boolean
  answer: boolean
  decline: boolean
}

/** A fresh input frame with nothing pressed. */
export function emptyInput(): InputFrame {
  return {
    mode: 'mouse',
    grip: false,
    gripId: -1,
    gripPressed: false,
    release: 'none',
    x: 0,
    y: 0,
    handAccel: 0,
    motionJolt: 0,
    tiltX: 0,
    tiltY: 0,
    walk: false,
    pour: 0,
    blow: false,
    swat: false,
    answer: false,
    decline: false
  }
}

/** Steadiness zone of a total level. */
export type Zone = 'green' | 'slosh' | 'break'
