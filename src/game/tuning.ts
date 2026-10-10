/**
 * Every tuning number for Water in a Sieve, in one place. PLAN.md explains the maths;
 * this file is the source of truth once it disagrees with the plan.
 */

import { TUNED } from './tune'

// ---------------------------------------------------------------- Design space

/** Logical design width; every screen fits this portrait design. */
export const DESIGN_WIDTH = 540
/** Logical design height. */
export const DESIGN_HEIGHT = 960
/** Portrait HUD bands: the top band ends here (logical y). */
export const TOP_BAND_END = 120
/** Portrait HUD bands: the bottom band starts here (logical y). */
export const BOTTOM_BAND_START = 820
/** Desktop columns need at least this many CSS px each, or the HUD uses bands. */
export const MIN_COLUMN_PX = 240
/** On a touch screen in columns, the Hold to Walk pad takes this share of the right column's height. */
export const COLUMN_PAD_SHARE = 0.22
/** The column pad's height stays between these CSS px, so a thumb always fits. */
export const COLUMN_PAD_MIN_PX = 96
export const COLUMN_PAD_MAX_PX = 180

// ---------------------------------------------------------------- Path and scenes

/** Length of the garden path in metres. */
export const PATH_METRES = 100
/** Logical units per metre on the walk strip. */
export const UNITS_PER_METRE = 40
/** Sieve cam centre and radius (logical units). */
export const CAM_X = 270
export const CAM_Y = 320
export const CAM_RADIUS = 120
/** Steadiness ring radius around the sieve cam. */
export const RING_RADIUS = 140
/** The ring and the HUD meter run to this total level. */
export const RING_MAX = 1.3
/** Sieve offset is drawn at this fraction of its size inside the cam, so a tip stays visible. */
export const CAM_OFFSET_SCALE = 0.6
/** Ground line of the walk strip (logical y). */
export const GROUND_Y = 770
/** Hero x when walking out, and when walking back. */
export const HERO_X_OUT = 170
export const HERO_X_BACK = 370

// ---------------------------------------------------------------- Sieve

/** Base sieve capacity in mL. */
export const BASE_CAPACITY_ML = 1000
/** Base drip: this fraction of the water per second. */
export const BASE_DRIP_PER_S = 0.008
/** Slosh at total 1.0 loses this fraction of the water per second. */
export const SLOSH_PER_S = 0.25
/** Tilt above this many degrees dribbles over the rim. */
export const DRIBBLE_DEGREES = 12
/** Tilt at or above this many degrees tips everything out. */
export const TIP_DEGREES = 30
/** Dribble at the tip angle loses this fraction of the water per second. */
export const DRIBBLE_PER_S = 0.3
/** Assist Mode multiplies both tilt thresholds by this. */
export const ASSIST_TILT_SCALE = 1.5
/** Desktop tilt in degrees per logical unit of sieve offset (100 units = 30 degrees). */
export const DEGREES_PER_UNIT = 0.3
/** A delivery moves everything; under this many mL the pour ends and leftovers drip. */
export const EMPTY_ML = 5

// ---------------------------------------------------------------- Steadiness

/** Total level zones: green below SLOSH_LEVEL, slosh up to BREAK_LEVEL, break at or above. */
export const SLOSH_LEVEL = 0.55
export const BREAK_LEVEL = 1
/** Hand meter: pointer acceleration in units/s² that reads as level 1. */
export const POINTER_REF = 6000
/** Hand meter: device jolt in m/s² that reads as level 1. A best guess for now. */
export const MOTION_REF = TUNED.MOTION_REF ?? 4
/** Hand meter rise and fall rates per second. */
export const HAND_RISE = 25
export const HAND_FALL = 3
/** Body level rise and fall rates per second. */
export const BODY_RISE = 25
export const BODY_FALL = 4
/**
 * Assist Mode scales the hand meter by this, in place of the shared 0.6. It's set so an
 * unskilled player with Assist fails about as often as an average one without it.
 */
export const HAND_ASSIST_SCALE = 0.78
/** Assist Mode scales the body level by this; Sensitivity never scales it. */
export const BODY_ASSIST_SCALE = 0.85
/** gait = GAIT_SCALE x (speed / CARRY_TOP_SPEED)^2. */
export const GAIT_SCALE = 0.6
/** Footsteps every this many metres add a bob to the gait. */
export const STEP_METRES = 0.8
/** Footstep bob as a fraction of gait. */
export const STEP_BOB = 0.15
/** Re-grab catch pulse. */
export const REGRAB_PULSE = 0.5
export const REGRAB_PULSE_MS = 150
/** Letting go starts a tip that a fresh press within this window catches. */
export const REGRAB_WINDOW_MS = 200
/** After a pause, a fresh grip runs this countdown before play resumes. */
export const HOLD_STILL_MS = 1000

// ---------------------------------------------------------------- Phone motion

/**
 * For this long after a touch press or release, motion jolt counts at TOUCH_GRACE_SCALE.
 * Both are best guesses until real-phone readings (PLAN.md, Owner Follow-Ups).
 */
export const TOUCH_GRACE_MS = TUNED.TOUCH_GRACE_MS ?? 150
export const TOUCH_GRACE_SCALE = TUNED.TOUCH_GRACE_SCALE ?? 0.5
/** Tipping the phone forward past this dips the sieve into the bucket. */
export const MOTION_DIP_DEGREES = 25
/** Tipping back under this lifts it out again. */
export const MOTION_LIFT_DEGREES = 8
/** How fast the sieve sinks into the bucket, and the slow lift out, in units per second. */
export const MOTION_DIP_SPEED = 400
export const MOTION_LIFT_SPEED = 110
/** Tilting right this far pours at full flow. */
export const MOTION_POUR_DEGREES = 25
/** Calibration refuses poses more than this far from flat. */
export const CALIBRATE_MAX_DEGREES = 45
/** The phone must be still this long before it calibrates. */
export const CALIBRATE_STEADY_MS = 500
/** Still means jolt under this (m/s²) and tilt moving less than CALIBRATE_DRIFT_DEGREES. */
export const CALIBRATE_STILL_JOLT = 0.6
export const CALIBRATE_DRIFT_DEGREES = 3
/** After a crank, a gentle recalibration only moves level by up to this many degrees. */
export const REFINE_MAX_DEGREES = 10
/** A gentle recalibration gives up after this long without a steady moment. */
export const REFINE_TIMEOUT_MS = 4000

// ---------------------------------------------------------------- Hand motion

/** Pointer velocity samples are at least this far apart, so bursts of events don't spike. */
export const HAND_SAMPLE_MS = 8
/** Velocity smoothing time constant in ms. */
export const HAND_SMOOTH_MS = 40
/** Velocity starts decaying after the pointer has been still this long. */
export const HAND_HOLD_MS = 50
/** Hand acceleration is measured over at least this many ms of frames. */
export const HAND_WINDOW_MS = 15

// ---------------------------------------------------------------- Drift

/** Drift amplitude in units: DRIFT_BASE + DRIFT_PER_SPEED x speed. */
export const DRIFT_BASE = 20
export const DRIFT_PER_SPEED = 8
/** Drift amplitude follows speed at this rate per second, so it never jumps. */
export const DRIFT_AMP_RATE = 2
/** The two drift frequencies in Hz. */
export const DRIFT_FREQ_A = 0.17
export const DRIFT_FREQ_B = 0.29
/** Arm fatigue starts after this many seconds of carrying water. */
export const FATIGUE_START_S = 15
/** Fatigue grows drift by this much per second after it starts. */
export const FATIGUE_PER_S = 0.06
/** Fatigue caps at this drift multiplier. */
export const FATIGUE_MAX = 2.2
/** The "Arms. Going." caption shows after this many seconds of carrying. */
export const FATIGUE_CAPTION_S = 20

// ---------------------------------------------------------------- Walking

export interface WalkMode {
  /** Top speed in m/s. */
  top: number
  /** Speed up in m/s² while walk is held. */
  accel: number
  /** Slow down in m/s² after walk is released. */
  decel: number
}

/** Carrying water: feather it like a throttle. */
export const CARRY_WALK: WalkMode = { top: 8, accel: 2.2, decel: 6 }
/** Walk back and empty walks: nothing to spill, run. */
export const RUN_WALK: WalkMode = { top: 18, accel: 8, decel: 12 }
/** House walk-in. */
export const HOUSE_WALK: WalkMode = { top: 3, accel: 1.6, decel: 6 }

// ---------------------------------------------------------------- Walk for Real

// Best guesses until a real phone's spike readings set the step thresholds (PLAN.md,
// Owner Follow-Ups). In dev, `?tune=` overrides MOTION_REF, touch grace and the Walk for
// Real numbers (tune.ts).
/** A step starts when the smoothed phone jolt rises past this (m/s²). */
export const STEP_START_JOLT = TUNED.STEP_START_JOLT ?? 0.8
/** It lands once the jolt falls back under this (m/s²), and its peak decides the pulse. */
export const STEP_END_JOLT = TUNED.STEP_END_JOLT ?? 0.4
/** A jolt held longer than this still counts as one step, so shaking can't stall it. */
export const STEP_MAX_MS = 400
/** Steps closer together than this count as one (ms). */
export const STEP_MIN_GAP_MS = 250
/** Each real step owes the walker this many metres: 50 steps make the 100 m path. */
export const REAL_STRIDE_M = TUNED.REAL_STRIDE_M ?? 2
/** At most this many metres can wait to be walked, so frantic steps can't bank distance. */
export const REAL_MAX_OWED_M = 4
/**
 * Speed is the stride over the time since the previous step. Longer gaps count as this,
 * so a first step from standing goes 1 m/s.
 */
export const REAL_SLOW_GAP_MS = 2000
/** No step for this long means you stopped: the rest of the last stride is dropped. */
export const REAL_STOP_MS = 1200
/** On empty walks a real step runs like holding walk for this long (ms). */
export const REAL_RUN_HOLD_MS = 800
/** While you walk for real, footsteps shake the phone: its jolt counts at this scale. */
export const REAL_HAND_SCALE = TUNED.REAL_HAND_SCALE ?? 0.5
/** Each real step pulses the body level by this much, for the footstep rhythm on the ring. */
export const REAL_STEP_PULSE = 0.15
/** Steps peaking above this (m/s²) add the stomp pulse on top. */
export const GENTLE_STEP_JOLT = TUNED.GENTLE_STEP_JOLT ?? 2
/** stomp pulse = STOMP_SCALE x (peak - GENTLE_STEP_JOLT)^2: a 3 m/s² stomp reaches 1. */
export const STOMP_SCALE = TUNED.STOMP_SCALE ?? 0.85
/** How long a step's pulse lasts (ms). */
export const REAL_STEP_PULSE_MS = 150

// ---------------------------------------------------------------- Trip flow

/** How long the drain or delivery result shows before the next step. */
export const RESULT_MS = 1600
/** The cold open after the start tap; any tap skips it. */
export const COLD_OPEN_MS = 8000
/** The cutscenes after the bucket and the sink fill. */
export const BUCKET_DONE_MS = 7400
export const SINK_DONE_MS = 7200
/** The bathtub milestone gags at 25, 50 and 75 L. */
export const DUCK_GAG_MS = 3000
export const CAT_GAG_MS = 3600
export const RESCHEDULE_GAG_MS = 3800
/** The ending: you step into the full tub, every tap bursts on, then two phone calls. */
export const ENDING_MS = 12_600
/** Presses this early in a cutscene don't skip it, so a click left over from the pour can't. */
export const SKIP_GUARD_MS = 400

// ---------------------------------------------------------------- Replays

/** Replay frames: 180 x 320 (the design's 9:16) at 20 fps, 3s of history. */
export const REPLAY_WIDTH = 180
export const REPLAY_HEIGHT = 320
export const REPLAY_FPS = 20
export const REPLAY_SECONDS = 3
/** The clip is cut this long after a drain, so it ends on the splash. */
export const REPLAY_AFTER_MS = 700
/** Slow-mo playback speed: a 3s clip plays in 7.5s. */
export const REPLAY_SPEED = 0.4
/** The first path drain at least this far out gets an automatic replay. */
export const REPLAY_FIRST_M = 10
/** Path drains this close to the house (or in it) with half a sieve or more get one too. */
export const REPLAY_NEAR_M = 85
/** Automatic replays come at most once per this many trips. */
export const REPLAY_EVERY_TRIPS = 3
/** A near miss's still is taken this long after the pour ends, over its caption. */
export const NEAR_MISS_SNAP_MS = 500
/** This many drains in a row, with no delivery between them, suggest Assist Mode once. */
export const ASSIST_SUGGEST_DRAINS = 4

// ---------------------------------------------------------------- Well

/** Circles that raise the well bucket, and in winter (frozen handle). */
export const CRANK_CIRCLES = 5
export const CRANK_CIRCLES_WINTER = 6
/** A crank circle faster than this slams the bucket into the pulley and slops a scoop. */
export const SLAM_CIRCLE_MS = 550
/** Scoops the raised bucket gives before it needs a refill. */
export const SCOOPS_PER_FILL = 5
/** Real-time refill after the last scoop. */
export const REFILL_MS = 60_000
/** Scoop fill time constant in seconds, and with Finer Mesh. */
export const FILL_TAU_S = 0.35
export const FILL_TAU_FINE_S = 1
/** A dip counts as a scoop when it gains at least this fraction of capacity. */
export const MIN_SCOOP_FRACTION = 0.1
/** The sieve needs at least this fraction of capacity to leave the well. */
export const MIN_CARRY_FRACTION = 0.1

/** Well scene layout, in logical units. */
export const WELL_X = 250
export const WELL_RIM_Y = 660
/** Top of the raised bucket, and the water line of a full one. */
export const BUCKET_TOP_Y = 588
export const WATER_FULL_Y = 600
/** The water line drops this far per scoop taken. */
export const WATER_PER_SCOOP_Y = 7
/** Where a grabbed sieve hovers, how deep it can go, and the lift line to the path. */
export const SIEVE_HOVER_Y = 545
export const SIEVE_DEEPEST_Y = 640
export const LIFT_Y = 470
/** The sieve hangs on this hook when you're not holding it. */
export const HOOK_X = 96
export const HOOK_Y = 600
/** Crank axle, handle radius, and how near a press must start to crank. */
export const CRANK_X = 430
export const CRANK_Y = 612
export const CRANK_RADIUS = 52
export const CRANK_HIT_RADIUS = 115
/** Frog hit radius, and how far it must be dragged off the handle to count. */
export const FROG_HIT_RADIUS = 55
export const FROG_DROP_DISTANCE = 110

// ---------------------------------------------------------------- Chores

/**
 * The director keeps open chores covering at least this share of a wait, so a 60s wait
 * leaves under 10s with nothing to do.
 */
export const DIRECTOR_COVER = 0.85
/** The director leaves waits with less than this many seconds left alone. */
export const DIRECTOR_MIN_LEFT_S = 10
/** A refill's house chore is the cat on this share of refills, otherwise a wet floor. */
export const DIRECTOR_CAT_SHARE = 0.3
/** Estimated seconds for each chore, for the director. */
export const CHORE_ESTIMATE_S = {
  frog: 10,
  wipe: 10,
  rewax: 15,
  cat: 6,
  plug: 6,
  leaves: 10,
  stone: 8,
  slippers: 5
} as const
/** An empty walk between the well and the house, each way. */
export const HOUSE_WALK_S = 7
/** The trip that starts a refill: carry, pour and run back. */
export const TRIP_WALK_S = 32

// ---------------------------------------------------------------- Workbench

/** Glue on the stitches dries for this long, in real time; it blocks scooping. */
export const GLUE_MS = 60_000
/** The needle's eye: hit radius, sway either side, and sway cycles per second. */
export const EYE_HIT = 12
export const EYE_SWAY = 30
export const EYE_SWAY_HZ = 0.45
/** Shaky hands sway the eye up to this many times further. */
export const EYE_SHAKE_GAIN = 2
/** Dragging the thread faster than this many units per second reads as fully shaky. */
export const EYE_SHAKE_SPEED = 1400
/** Stitch points have this hit radius, in bench units. */
export const STITCH_HIT = 18
/** The bench view of the sieve: centre and radius, in logical units. */
export const BENCH_X = 270
export const BENCH_Y = 492
export const BENCH_RADIUS = 180
/** Stitch points sit this far around a hole's centre on the bench. */
export const STITCH_RING = 46

// ---------------------------------------------------------------- House and pour

/** The walk from the path's end to the container, in metres. */
export const HOUSE_WALK_METRES = 4
/** Peak pour flow in L/s at a full pour value. */
export const POUR_MAX_LPS = 2
/** Pour value where flow starts, and the flow above which water splashes. */
export const POUR_START = 0.15
export const POUR_SAFE_LPS = 0.6
/** Splashing never takes more than this share of the flow. */
export const SPLASH_MAX = 0.7
/** Pointer offset right of the pour anchor that reads as a full pour, in units. */
export const POUR_RANGE = 120
/** D raises the pour value this much per second and it stays on release; A lowers it. */
export const POUR_KEY_UP = 0.5
export const POUR_KEY_DOWN = 1
/** Letting go or breaking during the pour lands this share in the container. */
export const DUMP_KEPT = 0.4
/** A pour that splashes this many mL leaves a wet patch on the floor. */
export const FLOOR_SPLASH_ML = 100

/** House scene layout: the hero walks in from HOUSE_HERO_START; the container sits at CONTAINER_X. */
export const HOUSE_HERO_START = 120
export const CONTAINER_X = 384
/** Pour gauge: a vertical bar at x POUR_GAUGE_X from POUR_GAUGE_TOP to POUR_GAUGE_BOTTOM. */
export const POUR_GAUGE_X = 60
export const POUR_GAUGE_TOP = 200
export const POUR_GAUGE_BOTTOM = 520

// ---------------------------------------------------------------- Economy

/** Coins per delivery: Math.round(mL / ML_PER_COIN), so 10 coins per litre. */
export const ML_PER_COIN = 100
/** No-Drip Trip bonus, and the scoop it needs as a share of capacity. */
export const NO_DRIP_BONUS = 10
export const NO_DRIP_MIN_SCOOP = 0.9

// ---------------------------------------------------------------- Path hazards

/** Bumps per container: bucket, sink, bathtub. */
export const BUMPS_PER_CONTAINER = [2, 4, 6] as const
/** Bumps sit at least this far apart, from BUMP_FIRST_M, and never in the last BUMP_CLEAR_END_M. */
export const BUMP_MIN_GAP_M = 8
export const BUMP_FIRST_M = 10
export const BUMP_CLEAR_END_M = 5
/** The very first trip has a single bump here, to teach the ring. */
export const FIRST_TRIP_BUMP_M = 20
/** A bump pulse lasts this long. */
export const BUMP_PULSE_MS = 120
/** A bump nudges the sieve down this far over BUMP_NUDGE_MS. */
export const BUMP_NUDGE_UNITS = 25
export const BUMP_NUDGE_MS = 150
/** The ring warns about hazards this far ahead. */
export const WARN_AHEAD_M = 12
/** Wet patches are this wide; a drain leaves one this far ahead, where the water lands. */
export const PATCH_WIDTH_M = 1.5
export const DRAIN_PATCH_AHEAD_M = 1.5
/** Outside winter, patches dry after this many trips. */
export const PATCH_DRY_TRIPS = 3
/** A new trip keeps at most this many patches on the path; the oldest dry or melt first. */
export const MAX_PATCHES = 6
/** Slip speeds in m/s: walking faster than this on a patch slips. */
export const SLIP_WET = 1.5
export const SLIP_ICE = 1
/** Assist Mode multiplies slip speeds by this. */
export const ASSIST_SLIP_SCALE = 1.5
/** A slip while carrying spikes the body level this much. */
export const SLIP_PULSE = 1.5
export const SLIP_PULSE_MS = 300
/** A slip on an empty walk sits you down for this long. */
export const PRATFALL_MS = 2000
/** Spring adds a fresh puddle on this share of trips; autumn adds this many leaf piles. */
export const SPRING_PUDDLE_CHANCE = 0.4
export const AUTUMN_LEAF_PILES = 1
/** Rub strokes that wipe a puddle or leaf pile, and that scrape ice away. */
export const WIPE_STROKES = 12
export const WIPE_STROKES_ICE = 20
/** On empty walks the Wipe prompt shows from this far ahead to WIPE_BEHIND_M behind. */
export const WIPE_AHEAD_M = 6
export const WIPE_BEHIND_M = 3
/** Stopping under this speed on a patch opens the rub area. */
export const WIPE_STOP_SPEED = 0.5
/** The rose bush covers this stretch of path from the sink phase (container 1) on. */
export const ROSE_FROM_M = 58
export const ROSE_TO_M = 62
export const ROSE_CONTAINER = 1
/** Carrying past the rose bush faster than this tears a hole in the mesh. */
export const ROSE_SAFE_SPEED = 3

// ---------------------------------------------------------------- Autumn leaves

/** Each leaf floating in the well water cuts a scoop by this share of capacity. */
export const LEAF_SCOOP_CUT = 0.15
/** At most this many leaves float in the well water. */
export const MAX_WELL_LEAVES = 3
/** In autumn a crank brings up leaves this often, 1 to MAX_WELL_LEAVES of them. */
export const CRANK_LEAF_CHANCE = 0.6
/** The pond the leaves float on in the cam: the well water's radius, in logical units. */
export const POND_RADIUS = 92
/** A dragged leaf counts as out once dropped this far past the water's edge. */
export const LEAF_OUT_MARGIN = 10
/** A press this close to a floating leaf drags it. */
export const LEAF_HIT_RADIUS = 40
/** A falling leaf drifts down for this long. */
export const LEAF_FALL_MS = 2600
/** Its landing shadow shows for the last this-many ms of the fall. */
export const LEAF_SHADOW_MS = 1200
/** Blowing this long at a falling leaf blows it off, and drives a fly back. */
export const BLOW_MS = 150
/** A leaf or fly landing on the water spikes the ring this much (the drain itself is direct). */
export const LAND_PULSE = 0.6
export const LAND_PULSE_MS = 150

// ---------------------------------------------------------------- The fly

/** The fly circles this long before it dives, on its first approach and when it comes back. */
export const FLY_CIRCLE_MS = 3000
export const FLY_RETURN_CIRCLE_MS = 1500
/** Its landing shadow shows for this long before touchdown. */
export const FLY_SHADOW_MS = 1200
/** Blown off, it zooms away for this long before it comes back, faster and angrier. */
export const FLY_RETREAT_MS = 900
/** It gives up after this many blows. */
export const FLY_GIVE_UP_BLOWS = 2

// ---------------------------------------------------------------- The sneeze

/** "Ah…" at 0s, "Ah…!" here, then the sneeze somewhere between these two times. */
export const SNEEZE_AH2_MS = 1000
export const SNEEZE_FROM_MS = 1800
export const SNEEZE_TO_MS = 2600
/** It's held in when you're slower than this, with a total level under SNEEZE_STILL_LEVEL. */
export const SNEEZE_STILL_SPEED = 0.3
export const SNEEZE_STILL_LEVEL = 0.3
/** This share of sneezes never come: "Ah… ah… never mind." */
export const SNEEZE_FAKE_CHANCE = 0.1
/** A held-in sneeze barely shakes you; a real one throws the water. */
export const SNEEZE_HELD_PULSE = 0.1
export const SNEEZE_PULSE = 1.4
export const SNEEZE_PULSE_MS = 250

// ---------------------------------------------------------------- The cat

/** The cat drinks this many mL per second from the container you're filling. */
export const CAT_DRINK_ML_PER_S = 8
/** It only bothers once the container holds this much. */
export const CAT_MIN_ML = 2000
/** It starts drinking on this share of trips while you're away. */
export const CAT_TRIP_CHANCE = 0.03
/** In the bathtub phase it pulls the plug on this share of trips. */
export const PLUG_TRIP_CHANCE = 0.05
/** An open plughole drains the tub this many mL per second. */
export const PLUG_ML_PER_S = 15
/** A press this close to the cat shoos it. */
export const CAT_HIT_RADIUS = 60
/** The pulled plug rests on the tub's rim here, and the plughole is here, in logical units. */
export const PLUG_REST_X = 486
export const PLUG_REST_Y = 662
export const PLUG_HOLE_X = 486
export const PLUG_HOLE_Y = 744
/** A press this close to the plug drags it; dropped this close to the hole, it's back in. */
export const PLUG_HIT_RADIUS = 44
export const PLUG_FIX_RADIUS = 34

// ---------------------------------------------------------------- The dog

/** The dog barks and peeks in from behind this long before it reaches you. */
export const DOG_WARN_MS = 1500
/** Slower than this when it arrives and it runs between your legs. */
export const DOG_STOP_SPEED = 0.5
/** It brushes past a standing hero, or trips a walking one. */
export const DOG_PASS_PULSE = 0.3
export const DOG_PASS_PULSE_MS = 200
export const DOG_TRIP_PULSE = 1.3
export const DOG_TRIP_PULSE_MS = 300

// ---------------------------------------------------------------- Phone calls

/** Your phone starts ringing on carries from this trip. */
export const RING_FROM_TRIP = 12
/** It rings this long before an ignored call starts buzzing. */
export const RING_WARN_MS = 1200
/** An ignored call rings for this long in all. */
export const RING_MS = 6000
/** Ignored, it buzzes in your pocket this often, this hard. */
export const RING_BUZZ_GAP_MS = 800
export const RING_BUZZ_PULSE = 0.35
export const RING_BUZZ_PULSE_MS = 150
/** Declining jabs the sieve a little. */
export const DECLINE_PULSE = 0.15
export const DECLINE_PULSE_MS = 100
/** Answering stops you for this long while the caller talks. */
export const TALK_MS = 5000
/** Mum sends this many coins for a snack when you answer. */
export const MUM_COINS = 20

// ---------------------------------------------------------------- Bathroom threats

/** In the bathtub phase, a threat follows you indoors on this share of trips with no carry event. */
export const BATH_THREAT_CHANCE = 0.15
/** It starts somewhere between these distances into the 4 m walk-in. */
export const BATH_THREAT_FROM_M = 0.3
export const BATH_THREAT_TO_M = 2
/** A fly through the door circles this long before its dive, since the walk-in is short. */
export const BATH_FLY_CIRCLE_MS = 1500
/** The cat trots in this long before it reaches your ankles. */
export const ANKLE_WARN_MS = 1200
/** Then it weaves round your ankles this long; walking any faster than this trips you. */
export const ANKLE_WEAVE_MS = 2000
export const ANKLE_STOP_SPEED = 0.5
/** Every rub against your legs nudges the sieve. */
export const ANKLE_RUB_GAP_MS = 600
export const ANKLE_RUB_PULSE = 0.25
export const ANKLE_RUB_PULSE_MS = 150
/** The house floor puddle sits this far into the walk-in, this wide either side, in metres. */
export const FLOOR_PUDDLE_M = 3
export const FLOOR_PUDDLE_HALF_M = 0.9
/** Carrying past this point on the path with a wet house floor, you hear about it. */
export const FLOOR_WARN_M = 85

// ---------------------------------------------------------------- Rain

/** Spring rain through the skylight adds this much to the tub, for this long. */
export const RAIN_ML_PER_S = 300
export const RAIN_MS = 10_000
/** Then it drains back out at this rate. */
export const RAIN_DRAIN_ML_PER_S = 400
/** After the first spring arrival, rain comes on this share of house arrivals. */
export const RAIN_CHANCE = 0.3

// ---------------------------------------------------------------- Events

/** No carry events before this trip. */
export const FIRST_EVENT_TRIP = 6
/** The chance of any carry event per trip never goes above this. */
export const MAX_EVENT_CHANCE = 0.6
/** The same event can't come back within this many trips. */
export const EVENT_COOLDOWN_TRIPS = 2
/** Carry events start somewhere between these distances, in metres. */
export const EVENT_FROM_M = 15
export const EVENT_TO_M = 85
/** Blowing at a fly or leaf shakes the sieve this much while held. */
export const BLOW_PULSE = 0.3
/** On phones a press this close to a fly or leaf blows at it instead of walking. */
export const BLOW_HIT_RADIUS = 50

// ---------------------------------------------------------------- Shop

/** Upgrade prices in coins. */
export const WAX_COST = 60
export const SLIPPERS_COST = 90
export const SWATTER_COST = 100
export const FINER_MESH_COST = 150
export const PAVED_PATH_COST = 200
export const BIGGER_SIEVE_COST = 300
/** The Bigger Sieve weighs every wobble this much more, and draws this much bigger. */
export const BIG_SIEVE_WEIGHT = 1.15
export const BIG_SIEVE_ART = 1.4
/** Paved Path: stones in the pile, one per 5 m segment of the path. */
export const STONES = 20
export const SEGMENT_M = 5
/** A laid stone flattens its segment's bumps, and footsteps on it jolt this much. */
export const PAVED_GAIT = 0.8
/** The Lay Stone prompt shows from this far before an unpaved segment. */
export const STONE_PROMPT_M = 3
/** Laying a stone stands you this far before the segment's middle, so its slot is ahead. */
export const STONE_STAGE_M = 3.5
/** A press this close to the stone picks it up; dropped this close to its slot, it's laid. */
export const STONE_HIT_RADIUS = 55
export const STONE_FIT_RADIUS = 45
/** Joke buys: a wish, a bag of cat treats, a party hat. */
export const WISH_COST = 10
export const TREATS_COST = 40
export const HAT_COST = 150
/** Wax wears off after this many trips, and the director offers Rewax this many trips early. */
export const WAX_TRIPS = 10
export const REWAX_DUE_TRIPS = 3
/** Rub strokes that put the wax back on at the bench. */
export const REWAX_STROKES = 20
/** Dry slippers scale the gait by this. */
export const SLIPPER_GAIT = 0.7
/** Slip speeds in m/s with dry slippers, and with soaked ones: wet, then ice. */
export const SLIP_WET_SLIPPERS = 2.5
export const SLIP_ICE_SLIPPERS = 1.8
export const SLIP_WET_SOAKED = 1
export const SLIP_ICE_SOAKED = 0.7
/** Soaked slippers dry on the washing line for this long, in real time. */
export const SLIPPERS_DRY_MS = 60_000
/** Where soaked slippers hang on the washing line at the well, and the wax tin sits. */
export const LINE_SLIPPERS_X = 150
export const LINE_SLIPPERS_Y = 548
export const WAX_TIN_X = 122
export const WAX_TIN_Y = 752
/** A press this close to the slippers' spot on the line, or to the wax tin, uses it. */
export const LINE_HIT_RADIUS = 45
export const TIN_HIT_RADIUS = 50
/** Each swatter swing jolts the sieve this much, for this long. */
export const SWAT_PULSE = 0.55
export const SWAT_PULSE_MS = 150
/** A swing takes this long; you can't swing again until it's done. */
export const SWING_MS = 350
/** Cat Treats keep the cat busy for this many trips per bag. */
export const TREAT_TRIPS = 5
/** One wish in this many brings the frog back to the crank. */
export const WISH_FROG_ODDS = 6

// ---------------------------------------------------------------- Holes

/** Each hole leaks this many mL per second while you carry. */
export const HOLE_LEAK_ML_PER_S = 50
/** The mesh holds at most this many holes. */
export const MAX_HOLES = 3

// ---------------------------------------------------------------- Containers and seasons

/** Winter starts at this many mL in the bathtub, and spring at SPRING_TUB_ML. */
export const WINTER_TUB_ML = 15_000
export const SPRING_TUB_ML = 60_000
/** Bathtub milestones in mL; each plays a short gag once. */
export const TUB_MILESTONES_ML = [25_000, 50_000, 75_000] as const
/** After this many trips a caption jokes "Year 2", with nothing new. */
export const YEAR_TWO_TRIP = 150

// ---------------------------------------------------------------- Autopilot skill

/**
 * A seeded player for the autopilot and the pacing test: how steady its hands are, how
 * fast it reacts and walks, and how long its chores take. M25 set the twitches and top
 * speeds so whole seeded games match the pacing model's success rates (PLAN.md section 5).
 */
export interface SkillProfile {
  /** Carry speed it aims for on clear ground, in m/s. */
  topSpeed: number
  /** Hand acceleration while steering smoothly, in units/s². */
  handAccel: number
  /** Seeded wobble on top of that, up to this many units/s². */
  handJitter: number
  /** Twitches per minute of holding water: one step of TWITCH_MIN to TWITCH_MAX units/s². */
  twitchesPerMin: number
  /** How long the hand takes to follow the drift, in ms. The lag leaves the sieve off the dot. */
  aimLagMs: number
  /** Typical reaction to a warning or a bump ahead, in ms; each one varies from half to 1.5 times this. */
  reactionMs: number
  /** Chore time against the director's estimates: 1 takes exactly CHORE_ESTIMATE_S. */
  chorePace: number
}

/** A twitch is one step of hand acceleration between these, in units/s². */
export const TWITCH_MIN = 3000
export const TWITCH_MAX = 20_000

export const SKILL_PROFILES: Record<'average' | 'unskilled', SkillProfile> = {
  average: {
    topSpeed: 5,
    handAccel: 300,
    handJitter: 500,
    twitchesPerMin: 1.5,
    aimLagMs: 250,
    reactionMs: 450,
    chorePace: 1
  },
  unskilled: {
    topSpeed: 3.5,
    handAccel: 450,
    handJitter: 1000,
    twitchesPerMin: 2,
    aimLagMs: 500,
    reactionMs: 900,
    chorePace: 1.4
  }
}
