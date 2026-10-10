import { rng, settings, type Rng } from '../shared'
import { benchStage } from './bench'
import { REWAX_CHORE } from './chores'
import type { CarryEvent } from './events'
import { canHangSlippers, gaitScale, type UpgradeId } from './kit'
import {
  inRose,
  nextBumpAhead,
  nextPatchAhead,
  nextRoseAhead,
  patchAt,
  patchById,
  patchWidth,
  pavedAt,
  slipSpeed
} from './path'
import type { Sim } from './sim'
import { sieveWeight } from './sieve'
import { predictedBumpLevel } from './steadiness'
import {
  BENCH_X,
  CARRY_WALK,
  CHORE_ESTIMATE_S,
  FLOOR_PUDDLE_HALF_M,
  FLOOR_PUDDLE_M,
  PAVED_GAIT,
  PLUG_HOLE_X,
  PLUG_HOLE_Y,
  REWAX_STROKES,
  ROSE_SAFE_SPEED,
  RUN_WALK,
  SIEVE_DEEPEST_Y,
  SIEVE_HOVER_Y,
  SKILL_PROFILES,
  TWITCH_MAX,
  TWITCH_MIN,
  WARN_AHEAD_M,
  WIPE_STROKES,
  type SkillProfile
} from './tuning'
import type { InputFrame } from './types'

export interface AutopilotOptions {
  /** Target carry speed in m/s. */
  speed: number
  /** Hand acceleration it reports while steering, in units/s². */
  handAccel: number
  /** Crank circle length in ms; under 550 slams the bucket. */
  crankMs: number
  /** Lift speed out of the bucket in units per second. */
  liftSpeed: number
  /** Pointer offset right of the pour anchor while pouring, in units. */
  pourOffset: number
  /** Time spent lining the thread up before waiting for the eye to swing past. */
  threadAimMs: number
  /** Time per stitch at the bench, per rub stroke and per leaf dragged out. */
  stitchMs: number
  /** How long a falling leaf's shadow shows before it blows, in ms. */
  blowReactMs: number
  /**
   * A human player: seeded hand wobble and twitches, steering lag, reaction times and
   * chores that take as long as the director expects. It also shops, walks to the house
   * for chores while a wait blocks the well, and wipes patches on empty walks. Null plays
   * flawlessly and fast, as the older tests expect.
   */
  skill: SkillProfile | null
  /** Seed for the skill's wobble, twitches and reaction times. */
  seed: number
}

export const DEFAULT_AUTOPILOT: AutopilotOptions = {
  speed: 4.5,
  handAccel: 250,
  crankMs: 800,
  liftSpeed: 70,
  pourOffset: 50,
  threadAimMs: 3000,
  stitchMs: 350,
  blowReactMs: 200,
  skill: null,
  seed: 1
}

export type SkillName = keyof typeof SKILL_PROFILES

/** Options for a seeded human player with one of the skill profiles. */
export function skilledPilot(name: SkillName, seed = 1): AutopilotOptions {
  const skill = SKILL_PROFILES[name]
  return {
    ...DEFAULT_AUTOPILOT,
    speed: skill.topSpeed,
    handAccel: skill.handAccel,
    blowReactMs: skill.reactionMs,
    stitchMs: 1000 * skill.chorePace,
    threadAimMs: 3000 * skill.chorePace,
    skill,
    seed
  }
}

/** Upgrades in the order the pacing model buys them. */
const SHOPPING: readonly UpgradeId[] = [
  'wax',
  'finerMesh',
  'slippers',
  'biggerSieve'
]

const STEP_MS = 1000 / 60
/** Seconds for one stitch, and for reaching for the glue, at chore pace 1. */
const STITCH_S = 1
/** How often the hand wobble picks a new target, in ms. */
const WOBBLE_MS = 200

/**
 * Plays the game: cranks, moves the frog, dips and lifts slowly, steers the sieve back
 * onto the dot against drift, feathers walk around a target speed and runs back. With a
 * skill profile it plays like a person (see `skill`). It writes input frames and calls
 * gesture commands. Only dev tools and tests import it, so production builds drop it.
 */
export class Autopilot {
  /** True on a step where a wait blocks the well and there was nothing to do. */
  idle = false
  private crankMs = 0
  private benchMs = 0
  private liftY = SIEVE_DEEPEST_Y
  private lifting = false
  private readonly random: Rng
  /** The chore in hand and the time spent on it so far. */
  private task = ''
  private taskMs = 0
  /** The lagging hand's pointer while carrying, and the wobble it reports. */
  private aimX = 0
  private aimY = 0
  private aiming = false
  private wobble = 0
  private wobbleTarget = 0
  private wobbleMs = 0
  /** The warning being reacted to, how long this reaction takes, and how far in it was. */
  private reactingTo: CarryEvent | null = null
  private reactMs = 0
  private reactSeenMs = 0

  constructor(private readonly options: AutopilotOptions = DEFAULT_AUTOPILOT) {
    this.random = rng(options.seed)
  }

  /** Fills `out` for this step and returns it. */
  frame(sim: Sim, out: InputFrame): InputFrame {
    const s = sim.state
    out.mode = 'mouse'
    out.release = 'none'
    out.handAccel = this.options.handAccel
    out.walk = false
    out.pour = 0
    out.blow = false
    out.answer = false
    out.decline = false
    out.gripPressed = false
    this.idle = false
    if (s.scene !== 'path' && s.scene !== 'house') this.aiming = false
    switch (s.scene) {
      case 'well':
        this.well(sim, out)
        break
      case 'path':
        this.carry(sim, out)
        break
      case 'house':
        if (s.phase === 'pour') this.pour(sim, out)
        else if (s.phase === 'visit') this.visit(sim, out)
        else this.carry(sim, out)
        break
      case 'cutscene':
        out.grip = false
        break
      default:
        this.emptyWalk(sim, out)
    }
    if (this.options.skill && sim.atStake()) this.shake(out)
    // A pause (a blur, a dialog) waits for a press; the pilot presses at once.
    if (s.paused) out.gripPressed = true
    return out
  }

  /** Seconds a chore takes at this player's pace; a flawless pilot takes `quick`. */
  private pace(seconds: number, quick = 0): number {
    const skill = this.options.skill
    return skill ? seconds * skill.chorePace : quick
  }

  /** True once `seconds` of work on `key` has passed; a new key starts the clock again. */
  private worked(key: string, seconds: number): boolean {
    if (key !== this.task) {
      this.task = key
      this.taskMs = 0
    }
    this.taskMs += STEP_MS
    if (this.taskMs < seconds * 1000) return false
    this.taskMs = 0
    return true
  }

  private well(sim: Sim, out: InputFrame): InputFrame {
    const s = sim.state
    const well = s.well
    const grip = s.grip
    const empty = s.sieve.inSieve === 0 && !grip.held
    const rewax = sim.chores.has(REWAX_CHORE.id)
    out.grip = false
    if (s.bench.open || ((s.holes.length > 0 || rewax) && empty))
      return this.bench(sim, out)
    if (empty) this.shop(sim)
    if (canHangSlippers(sim)) {
      if (this.worked('slippers', this.pace(CHORE_ESTIMATE_S.slippers)))
        sim.hangSlippers()
      if (this.options.skill) return out
    }
    if (well.frog !== 'none') {
      // It hops back once, so it takes two drags.
      if (this.worked('frog', this.pace(CHORE_ESTIMATE_S.frog / 2))) {
        sim.dragFrog(40, 760)
        sim.dropFrog(40, 760)
      }
      if (this.options.skill) return out
    }
    // Leaves clog every scoop: drag them out first, one at a time.
    const leaf = well.leaves[0]
    if (leaf && !grip.held && sim.canClearLeaves()) {
      this.benchMs += STEP_MS
      const each = this.pace(CHORE_ESTIMATE_S.leaves / 3) * 1000
      if (this.benchMs >= (each || this.options.stitchMs)) {
        sim.removeLeaf(leaf.id)
        this.benchMs = 0
      }
      return out
    }
    // The last scoop lowers the bucket mid-lift: keep lifting whatever is in the sieve.
    const lifting = grip.held && s.sieve.inSieve > 0
    if (this.options.skill && empty) {
      // The cat or the plug empties the container: go and stop it.
      if ((s.cat.mood === 'drinking' || s.cat.plugOut) && sim.goToHouse())
        return out
      // A wait blocks the well: do the chores elsewhere, or stand and stare.
      if (this.waiting(sim)) {
        if (this.choresAway(sim) && sim.goToHouse()) return out
        this.idle = true
        return out
      }
    }
    if (s.phase === 'crank' && !lifting) {
      this.crankMs += STEP_MS
      if (this.crankMs >= this.options.crankMs) {
        this.crankMs = 0
        sim.crankCircle(1, this.options.crankMs)
      }
      return out
    }
    if (s.phase !== 'scoop' && !lifting) return out
    out.grip = true
    out.gripId = 1
    out.gripPressed = !grip.held
    if (!grip.held) {
      out.x = 270
      out.y = 500
      this.liftY = SIEVE_DEEPEST_Y - 5
      this.lifting = false
      return out
    }
    // Dip until nearly full, then lift slowly all the way out.
    if (s.sieve.inSieve >= sim.fillCap() * 0.93) this.lifting = true
    if (this.lifting && s.sieve.inSieve === 0) this.lifting = false
    if (this.lifting) this.liftY -= (this.options.liftSpeed * STEP_MS) / 1000
    else this.liftY = SIEVE_DEEPEST_Y - 5
    out.x = grip.anchorX
    out.y = grip.anchorY + (this.liftY - SIEVE_HOVER_Y)
    return out
  }

  /** A wait blocks the well: the refill keeps the crank still, or glue keeps you from scooping. */
  private waiting(sim: Sim): boolean {
    const s = sim.state
    if (s.phase === 'idle') return s.waits.refill !== null
    return s.phase === 'scoop' && s.waits.glue !== null
  }

  /** Chores that need a walk: the cat, the plug, the house floor, or a path patch. */
  private choresAway(sim: Sim): boolean {
    for (const chore of sim.chores.list()) {
      const id = chore.id
      if (id === 'cat' || id === 'plug' || id === 'wipe') return true
      if (id.startsWith('patch-')) return true
    }
    return false
  }

  /** Buys the next upgrade in the pacing model's order once it can afford it. */
  private shop(sim: Sim): void {
    if (!this.options.skill || !sim.canShop()) return
    for (const id of SHOPPING) {
      if (sim.shop.owned(id)) continue
      if (sim.wallet.canAfford(sim.shop.get(id).cost)) sim.buy(id)
      return
    }
  }

  /**
   * Works at the bench: threads as the eye swings past, stitches in order, glues, and
   * rubs the wax back on.
   */
  private bench(sim: Sim, out: InputFrame): InputFrame {
    const s = sim.state
    out.grip = false
    if (!s.bench.open) {
      this.benchMs = 0
      sim.openBench(s.holes.length > 0 ? 'mend' : 'wax')
      return out
    }
    this.benchMs += STEP_MS
    const stage = benchStage(s.bench, s.holes)
    if (stage === 'wax') {
      const each = this.pace(CHORE_ESTIMATE_S.rewax / REWAX_STROKES) * 1000
      if (this.benchMs >= (each || this.options.stitchMs)) {
        sim.rubWax()
        this.benchMs = 0
      }
    } else if (stage === 'thread') {
      const lined = this.benchMs >= this.options.threadAimMs
      if (lined && Math.abs(sim.eyeX() - BENCH_X) < 4) {
        sim.threadNeedle(true)
        this.benchMs = 0
      }
    } else if (stage === 'sew') {
      const hole = s.holes.find(h => h.stitched < h.points)
      const each = this.pace(STITCH_S) * 1000
      if (hole && this.benchMs >= (each || this.options.stitchMs)) {
        sim.stitch(hole.id, hole.stitched)
        this.benchMs = 0
      }
    } else if (this.benchMs >= this.pace(STITCH_S) * 1000) {
      sim.applyGlue()
    }
    return out
  }

  /**
   * Runs the empty walks, laying the walk's paving stone and wiping patches on the way. A
   * person slows down for patches rather than land on their backside.
   */
  private emptyWalk(sim: Sim, out: InputFrame): InputFrame {
    const s = sim.state
    const skill = this.options.skill
    out.grip = false
    out.walk = !skill || s.walker.speed < this.skilledSpeed(sim, skill)
    if (s.wipe) {
      out.walk = false
      this.rub(sim)
      return out
    }
    if (s.stone.placing) {
      out.walk = false
      if (this.worked('stone', this.pace(CHORE_ESTIMATE_S.stone)))
        sim.layStone()
      return out
    }
    const action = sim.contextAction()
    if (action === 'stone') {
      sim.doContext()
      out.walk = false
    } else if (
      (action === 'wipe' || action === 'scrape' || action === 'sweep') &&
      this.wipesNow(sim)
    ) {
      sim.doContext()
      out.walk = false
    }
    return out
  }

  /**
   * A person wipes a patch on an empty walk when it's on the chore list, or it's ice,
   * while a wait leaves time to kill.
   */
  private wipesNow(sim: Sim): boolean {
    if (!this.options.skill) return false
    const s = sim.state
    const patch = patchById(s.path, s.promptPatch)
    if (!patch) return false
    const listed = sim.chores.has(`patch-${patch.id}`)
    const spare = s.waits.refill !== null || s.waits.glue !== null
    return spare && (listed || patch.kind === 'ice')
  }

  /** One rub stroke on the open rub area, at the pace of a wipe that takes its estimate. */
  private rub(sim: Sim): void {
    const each = this.pace(CHORE_ESTIMATE_S.wipe / WIPE_STROKES) * 1000
    this.benchMs += STEP_MS
    if (this.benchMs < (each || this.options.stitchMs)) return
    this.benchMs = 0
    sim.rub()
  }

  /** On a house visit: shoos the cat, puts the plug back, rubs the floor dry, then walks back. */
  private visit(sim: Sim, out: InputFrame): InputFrame {
    const s = sim.state
    out.grip = false
    if (s.cat.mood === 'drinking') {
      if (this.worked('cat', this.pace(CHORE_ESTIMATE_S.cat))) sim.shooCat()
      return out
    }
    if (s.cat.plugOut) {
      if (this.worked('plug', this.pace(CHORE_ESTIMATE_S.plug))) {
        sim.dragPlug(PLUG_HOLE_X, PLUG_HOLE_Y)
        sim.dropPlug(PLUG_HOLE_X, PLUG_HOLE_Y)
      }
      return out
    }
    if (s.wipe) {
      this.rub(sim)
      return out
    }
    if (empty(sim)) this.shop(sim)
    out.walk = s.house.leaveArmed
    return out
  }

  /** Pours inside the green band: 50 units right of the pour anchor. */
  private pour(sim: Sim, out: InputFrame): InputFrame {
    const s = sim.state
    out.grip = true
    out.gripId = 1
    out.x = s.house.pourAnchorX + this.options.pourOffset
    out.y = s.grip.y
    out.pour = 0
    return this.counter(sim, out)
  }

  /**
   * Counters whatever is after you, once it has reacted: blows a leaf or fly off once its
   * shadow shows, freezes for a sneeze, the dog or the cat, and answers the phone (giving
   * the interviewer the first answer).
   */
  private counter(sim: Sim, out: InputFrame): InputFrame {
    const event = sim.state.event
    if (event?.stage !== 'warning') return out
    const react = this.reaction(event)
    if (
      event.id === 'sneeze' ||
      event.id === 'dog' ||
      event.id === 'catAnkles'
    ) {
      if (event.ms >= react) out.walk = false
    } else if (event.id === 'ring') out.answer = event.ms >= react
    else
      out.blow =
        event.retreatMs <= 0 &&
        event.ms >= event.warnMs - event.shadowMs + react
    return out
  }

  /** How long this player takes to react to `event`: drawn once per approach. */
  private reaction(event: CarryEvent): number {
    const skill = this.options.skill
    if (!skill)
      return event.id === 'fly' || event.id === 'leaf'
        ? this.options.blowReactMs
        : 0
    // A new event, or the same fly coming back for another go.
    if (this.reactingTo !== event || event.ms < this.reactSeenMs) {
      this.reactingTo = event
      this.reactMs = skill.reactionMs * (0.5 + this.random())
    }
    this.reactSeenMs = event.ms
    return this.reactMs
  }

  private carry(sim: Sim, out: InputFrame): InputFrame {
    const s = sim.state
    const grip = s.grip
    out.grip = true
    out.gripId = 1
    out.gripPressed = !grip.held && (s.phase === 'carry' || s.phase === 'enter')
    // Cancel the drift so the offset stays at 0: pointer = anchor - drift.
    const x = grip.anchorX - s.drift.x
    const y = grip.anchorY - s.drift.y
    const skill = this.options.skill
    if (skill && this.aiming) {
      // A person's hand follows the drift a little late.
      const k = 1 - Math.exp(-STEP_MS / skill.aimLagMs)
      this.aimX += (x - this.aimX) * k
      this.aimY += (y - this.aimY) * k
    } else {
      this.aimX = x
      this.aimY = y
      this.aiming = true
    }
    out.x = this.aimX
    out.y = this.aimY
    out.walk = s.walker.speed < this.targetSpeed(sim)
    return this.counter(sim, out)
  }

  /** Hand wobble and the odd twitch while water is in your hands. */
  private shake(out: InputFrame): void {
    const skill = this.options.skill
    if (!skill) return
    this.wobbleMs += STEP_MS
    if (this.wobbleMs >= WOBBLE_MS) {
      this.wobbleMs = 0
      this.wobbleTarget = this.random() * skill.handJitter
    }
    this.wobble += (this.wobbleTarget - this.wobble) * 0.2
    out.handAccel = skill.handAccel + this.wobble
    const chance = (skill.twitchesPerMin / 60) * (STEP_MS / 1000)
    if (this.random() < chance)
      out.handAccel = TWITCH_MIN + this.random() * (TWITCH_MAX - TWITCH_MIN)
  }

  /** Slows for bumps and the rose bush and tiptoes over wet patches, like a careful player. */
  private targetSpeed(sim: Sim): number {
    const s = sim.state
    if (this.options.skill) return this.skilledSpeed(sim, this.options.skill)
    // Tiptoe over a wet house floor on the walk-in.
    if (s.scene === 'house')
      return s.house.floorPatch && s.walker.distance < FLOOR_PUDDLE_M + 1
        ? 1.2
        : this.options.speed
    if (s.scene !== 'path') return this.options.speed
    const at = s.walker.distance
    if (nextPatchAhead(s.path, at, 1) < 3 || patchAt(s.path, at)) return 1.2
    if (nextRoseAhead(s.path, at) < 5 || inRose(s.path, at))
      return ROSE_SAFE_SPEED - 0.8
    return nextBumpAhead(s.path, at) < 6 ? 2.4 : this.options.speed
  }

  /**
   * A person sees hazards coming. Carrying, they start slowing a reaction before braking
   * distance: under the slip speed of each patch, past the rose bush, and over bumps as
   * slowly as the ghost tick asks. Running light, they brake just in time for patches.
   */
  private skilledSpeed(sim: Sim, skill: SkillProfile): number {
    const s = sim.state
    const v = s.walker.speed
    const at = s.walker.distance
    const assist = settings.get().assist
    const empty = s.scene === 'walkBack'
    const decel = empty ? RUN_WALK.decel : CARRY_WALK.decel
    const reach = (want: number) =>
      Math.max(0, (v * v - want * want) / (2 * decel)) +
      (v * skill.reactionMs) / 1000 +
      HAZARD_MARGIN_M
    if (empty) {
      // Running light toward patches seen from far off: brake just in time.
      const dir = s.walker.dir
      let target = RUN_WALK.top
      for (const patch of s.path.patches) {
        const half = patchWidth(patch) / 2
        const near = (patch.at - at) * dir - half
        if (near + 2 * half < 0 || patch.id === s.safePatch) continue
        const want =
          slipSpeed(patch.kind, assist, s.kit.slippers) * PATCH_SAFETY
        const braking = Math.max(0, (v * v - want * want) / (2 * decel))
        if (near <= braking + HAZARD_MARGIN_M) target = Math.min(target, want)
      }
      return target
    }
    let target = this.options.speed
    if (s.scene === 'house') {
      const want = slipSpeed('wet', assist, s.kit.slippers) * PATCH_SAFETY
      const near = FLOOR_PUDDLE_M - FLOOR_PUDDLE_HALF_M - at
      const far = FLOOR_PUDDLE_M + FLOOR_PUDDLE_HALF_M - at
      if (s.house.floorPatch && far > 0 && near <= reach(want)) target = want
      return target
    }
    if (s.scene !== 'path') return target
    for (const patch of s.path.patches) {
      const half = patchWidth(patch) / 2
      if (patch.at + half < at) continue
      const want = slipSpeed(patch.kind, assist, s.kit.slippers) * PATCH_SAFETY
      if (patch.at - half - at <= reach(want)) target = Math.min(target, want)
    }
    const thorny = ROSE_SAFE_SPEED - 0.8
    if (nextRoseAhead(s.path, at) <= reach(thorny) || inRose(s.path, at))
      target = Math.min(target, thorny)
    const bump = nextBumpAhead(s.path, at)
    if (bump <= WARN_AHEAD_M) {
      const safe = this.bumpSpeed(sim, assist)
      if (bump <= reach(safe)) target = Math.min(target, safe)
    }
    return target
  }

  /**
   * The speed a person slows to for the next bump: the fastest that keeps the ring's ghost
   * tick under GHOST_SAFE, as the ring shows it.
   */
  private bumpSpeed(sim: Sim, assist: boolean): number {
    const s = sim.state
    const at = s.walker.distance
    const scales = {
      weight: sieveWeight(s.gear),
      gaitScale:
        gaitScale(s.kit.slippers) * (pavedAt(s.path, at) ? PAVED_GAIT : 1)
    }
    for (let v = this.options.speed; v > BUMP_CRAWL; v -= 0.25)
      if (predictedBumpLevel(s.steady.hand, v, assist, scales) <= GHOST_SAFE)
        return v
    return BUMP_CRAWL
  }
}

/** A person crosses patches at this share of their slip speed. */
const PATCH_SAFETY = 0.75
/** A person slows for a bump until the ghost tick reads under this level. */
const GHOST_SAFE = 0.8
/** No bump makes a person go slower than this, in m/s. */
const BUMP_CRAWL = 1.5
/** Extra room a person leaves before a hazard, in metres. */
const HAZARD_MARGIN_M = 1

/** The sieve is empty and down. */
function empty(sim: Sim): boolean {
  return sim.state.sieve.inSieve === 0 && !sim.state.grip.held
}
