import { exposeDev, restartGame, type DevAction, type Viewport } from './shared'
import {
  closeModal,
  openReplay,
  openShare,
  pressContext,
  type Game
} from './shell'
import {
  Autopilot,
  DEFAULT_AUTOPILOT,
  skilledPilot,
  type AutopilotOptions,
  type SkillName
} from './game/autopilot'
import { CONTAINERS, type ContainerId } from './game/containers'
import { BATH_THREATS } from './game/events'
import {
  soakSlippers,
  UPGRADES,
  wearWax,
  type JokeId,
  type UpgradeId
} from './game/kit'
import { addPatch, type Patch } from './game/path'
import { drainSpot } from './game/replays'
import { SEASONS } from './game/seasons'
import { PLUG_HOLE_X, PLUG_HOLE_Y } from './game/tuning'
import type {
  CutsceneId,
  InputFrame,
  LossCause,
  SceneId,
  Season
} from './game/types'
import type { InputSystem } from './scenes/input'
import { FakeMotion } from './scenes/motion'
import { perf } from './scenes/perf'
import type { Renderer } from './scenes/renderer'

interface DevContext {
  game: Game
  input: InputSystem
  viewport: Viewport
  renderer: Renderer
}

interface LoopApi {
  step(updates?: number): void
}

/**
 * Events dev tools can start: `leaf`, `fly` and `sneeze` start on this carry (or the next
 * one), `bathroom` sends a random threat after you into the house (`catAnkles` the cat), `leaves` floats 3 leaves in the well water, `catDrink` sets the cat drinking from
 * a container holding 2 L or more, and `catPlug` pulls the bathtub plug.
 */
type DevEvent =
  | 'leaf'
  | 'fly'
  | 'sneeze'
  | 'dog'
  | 'ring'
  | 'bathroom'
  | 'catAnkles'
  | 'rain'
  | 'leaves'
  | 'catDrink'
  | 'catPlug'

/**
 * Dev-only tools: `window.__game.sieve` for browser automation and the dev panel
 * actions. App loads this module through a dynamic import inside `import.meta.env.DEV`,
 * so production builds drop it along with the autopilot.
 */
export function installDev({ game, input, viewport, renderer }: DevContext): {
  dispose: () => void
  actions: DevAction[]
  showEnding: () => void
} {
  const { sim, hud } = game
  /**
   * Hands the controls to the autopilot. With a `profile` it plays like an average or
   * unskilled person (and shops, walks to house chores, fails now and then); without one
   * it plays flawlessly.
   */
  const setAutopilot = (
    on: boolean,
    {
      profile,
      ...options
    }: Partial<AutopilotOptions> & { profile?: SkillName } = {}
  ) => {
    const base = profile
      ? skilledPilot(profile, Math.floor(Math.random() * 1e9))
      : DEFAULT_AUTOPILOT
    const pilot = new Autopilot({ ...base, ...options })
    // Handing back to real input is a release the real pointer never sent: pause.
    if (!on && game.pilot && sim.state.grip.held) sim.pause()
    game.pilot = on ? frame => pilot.frame(sim, frame) : null
  }
  const api = {
    state: () => sim.state,
    snapshot: () => hud.get(),
    ledger: () => {
      const l = sim.state.sieve
      return {
        litres: {
          scooped: l.scooped / 1000,
          inSieve: l.inSieve / 1000,
          delivered: l.delivered / 1000,
          drained: l.drained / 1000,
          dripped: l.dripped / 1000,
          splashed: l.splashed / 1000
        },
        balanced: sim.balanced()
      }
    },
    /** Logical design units to client px, for dispatching pointer events. */
    toClient: (x: number, y: number) => {
      const rect = viewport.canvas?.getBoundingClientRect()
      return {
        x: (rect?.left ?? 0) + viewport.offsetX + x * viewport.scale,
        y: (rect?.top ?? 0) + viewport.offsetY + y * viewport.scale
      }
    },
    setSieve: (l: number) => sim.setSieve(l * 1000),
    /** Sets trips started; the next lift out of the well starts trip n + 1. */
    setTrip: (n: number) => {
      sim.state.trip = Math.max(0, Math.floor(n))
    },
    /**
     * Sets a container's litres; it becomes the one you fill, earlier ones count as full,
     * and the season follows.
     */
    setContainer: (id: ContainerId, litres = 0) => {
      const index = CONTAINERS.findIndex(c => c.id === id)
      if (index >= 0) sim.setContainer(index, litres * 1000)
    },
    /** Reads the season, or jumps to one. */
    season: (season?: Season) => {
      if (season) sim.setSeason(season)
      return sim.state.season
    },
    /** Tears holes in the mesh, up to 3. */
    addHole: (count = 1) => sim.addHoles(count),
    /**
     * Jumps to a scene: 'path' carries a full sieve from `distance` m (or walks empty to
     * the house with `full: false`), 'house' walks in full or arrives for a visit,
     * 'walkBack' runs home from `distance` m, and 'well' stands at the well.
     */
    goto: (
      scene: Exclude<SceneId, 'cutscene'>,
      options?: { distance?: number; full?: boolean }
    ) => sim.jumpTo(scene, options),
    /** Plays a cutscene now, such as 'bucketDone' or 'duck'. */
    cutscene: (id: CutsceneId) => sim.startCutscene(id),
    /** Puts a wet patch, ice or a leaf pile on the path at `at` metres. */
    addPatch: (at: number, kind: Patch['kind'] = 'wet') =>
      addPatch(sim.state.path, at, kind).id,
    /** The context slot's button now, and pressing it (Share opens the share dialog). */
    context: () => sim.contextAction(),
    doContext: () => pressContext(game),
    /** The latest drain on film: its label, frame count and whether it opened by itself. */
    replay: () => {
      const shot = game.shots.fail
      if (!shot) return null
      return {
        id: shot.id,
        label: drainSpot(shot.drain),
        caption: shot.caption,
        frames: shot.clip.frames.length,
        auto: shot.drain.replay,
        still: shot.clip.still !== null,
        open: game.ui.get().modal === 'replay'
      }
    },
    /** Opens the latest drain's replay. */
    openReplay: () => {
      const shot = game.shots.fail
      if (shot) openReplay(game, shot)
      return shot !== null
    },
    /** Opens the share dialog for this walk back's card, if there is one. */
    share: () => {
      openShare(game)
      return game.ui.get().modal === 'share'
    },
    /** The open dialog, and closing it as Skip or Close would. */
    dialog: () => game.ui.get().modal,
    closeDialog: () => closeModal(game),
    /** Fills the tub and plays the ending now. */
    showEnding: () => {
      sim.setContainer(2, 100_000)
      const tub = sim.state.containers[2]
      if (tub) tub.done = true
      sim.startCutscene('ending')
    },
    /** Rub strokes on the open rub area. */
    rub: (strokes = 1) => sim.rub(strokes),
    /** Starts an event now, such as 'leaf' or 'leaves'. */
    trigger: (event: DevEvent) => {
      if (
        event === 'leaf' ||
        event === 'fly' ||
        event === 'sneeze' ||
        event === 'dog' ||
        event === 'ring'
      )
        sim.triggerEvent(event)
      else if (event === 'bathroom' || event === 'catAnkles')
        sim.triggerBathroom(
          event === 'catAnkles'
            ? 'catAnkles'
            : (BATH_THREATS[Math.floor(Math.random() * 3)] ?? 'fly')
        )
      else if (event === 'rain') return sim.triggerRain()
      else if (event === 'leaves') sim.dropLeaves(3)
      else if (event === 'catDrink') return sim.triggerCat()
      else return sim.triggerPlug()
      return true
    },
    /** Sends a bathroom threat after you: 'fly', 'catAnkles' or 'sneeze'. */
    bathroom: (id: 'fly' | 'catAnkles' | 'sneeze' = 'fly') =>
      sim.triggerBathroom(id),
    /** Where the falling leaf or fly is now, in logical units, or null. */
    blowTarget: () => {
      const spot = sim.blowTarget({ x: 0, y: 0, height: 0 })
      return spot && { x: spot.x, y: spot.y }
    },
    /** Answers or declines a ringing call, or answers the interviewer with E or F. */
    call: (what: 'answer' | 'decline' | 'e' | 'f') =>
      what === 'answer'
        ? sim.answerCall()
        : what === 'decline'
          ? sim.declineCall()
          : sim.chooseAnswer(what),
    /** Taps the cat on a house visit. */
    shooCat: () => sim.shooCat(),
    /** Drags the pulled plug back into its hole on a house visit. */
    fixPlug: () => {
      sim.dragPlug(PLUG_HOLE_X, PLUG_HOLE_Y)
      return sim.dropPlug(PLUG_HOLE_X, PLUG_HOLE_Y)
    },
    /** Takes a floating leaf out of the well water, as if dragged over the rim. */
    removeLeaf: (id?: number) => {
      const leaf = id ?? sim.state.well.leaves[0]?.id
      return leaf !== undefined && sim.removeLeaf(leaf)
    },
    /** Buys an upgrade; `free` adds its price first. */
    buy: (id: UpgradeId, options?: { free?: boolean }) => sim.buy(id, options),
    /** Buys a wish, cat treats or the party hat; returns its line, or null. */
    buyJoke: (id: JokeId) => sim.buyJoke(id),
    /** Whether the shop would open here. */
    canShop: () => sim.canShop(),
    /** Soaks dry slippers, as if water landed on them. */
    soakSlippers: () => soakSlippers(sim),
    /** Hangs soaked slippers on the line at the well. */
    hangSlippers: () => sim.hangSlippers(),
    /** Wears the wax off now, opening the Rewax chore. */
    wearWax: () => {
      sim.state.kit.waxTripsLeft = 0
      wearWax(sim)
    },
    /** Rub strokes with the wax block at the open bench. */
    rubWax: (strokes = 1) => sim.rubWax(strokes),
    /** Presses Swat, as the phone button does. */
    swat: () => sim.swat(),
    /** Gets the walk's paving stone out if the prompt shows, and lays it. */
    layStone: () => {
      if (sim.contextAction() === 'stone') sim.doContext()
      return sim.layStone()
    },
    addCoins: (amount: number) => sim.wallet.earn(amount, 'Dev'),
    coins: () => sim.wallet.coins(),
    finishWaits: () => sim.finishWaitsNow(),
    drain: (cause: LossCause = 'jolt') => sim.drain(cause),
    input: {
      set: (frame: Partial<InputFrame>) => {
        input.override = { ...input.override, ...frame }
      },
      clear: () => {
        input.override = null
      },
      /** Applies one frame per sample, stepping the loop between them, then clears. */
      path: (samples: Partial<InputFrame>[], hz = 60) => {
        const loop = window.__game?.loop as LoopApi | undefined
        const steps = Math.max(1, Math.round(60 / hz))
        for (const sample of samples) {
          input.override = { ...input.override, ...sample }
          loop?.step(steps)
        }
        input.override = null
      }
    },
    /**
     * Replaces the motion sensors with a fixed reading, levelled at flat unless the tray
     * step is waiting to calibrate, or hands back to the real sensors with null. Motion
     * mode also needs a touch press.
     */
    fakeMotion: (
      reading: { jolt?: number; tiltX?: number; tiltY?: number } | null
    ) => {
      const tilt = game.tilt
      if (!reading) {
        tilt.setSource(game.motion)
        return
      }
      const current = tilt.source
      const fake = current instanceof FakeMotion ? current : new FakeMotion()
      fake.jolt = reading.jolt ?? fake.jolt
      fake.peakJolt = Math.max(fake.jolt, reading.jolt ?? 0)
      fake.rawX = reading.tiltX ?? fake.rawX
      fake.rawY = reading.tiltY ?? fake.rawY
      if (fake === current) return
      // Level at the first reading, unless "Hold It Like a Tray" is waiting to do it.
      tilt.setSource(fake)
      if (!tilt.wanted) {
        const { rawX, rawY } = fake
        fake.rawX = fake.rawY = 0
        tilt.calibrateNow()
        fake.rawX = rawX
        fake.rawY = rawY
      }
    },
    /** Reads Walk for Real, or turns it on or off. */
    realWalk: (on?: boolean) => {
      if (on !== undefined) sim.setWalkForReal(on)
      return sim.state.realWalk.on
    },
    /**
     * Fakes real steps through the fake phone: each one jolts it to `peak` m/s² for
     * 120 ms, one step every `everyMs`, stepping the loop. Needs motion mode.
     */
    fakeSteps: (
      count: number,
      { peak = 1.5, everyMs = 550 }: { peak?: number; everyMs?: number } = {}
    ) => {
      const loop = window.__game?.loop as LoopApi | undefined
      const stepMs = 1000 / 60
      for (let i = 0; i < count; i++) {
        api.fakeMotion({ jolt: peak })
        loop?.step(Math.round(120 / stepMs))
        api.fakeMotion({ jolt: 0.1 })
        loop?.step(Math.max(1, Math.round((everyMs - 120) / stepMs)))
      }
      const s = sim.state
      return {
        metres: s.walker.distance,
        steps: s.realWalk.steps,
        scene: s.scene,
        phase: s.phase
      }
    },
    /** The input set in use: 'mouse', 'touch' or 'motion'. */
    mode: () => input.mode,
    autopilot: setAutopilot,
    /** Reloads the page without the leave prompt, for a fresh start. */
    restart: () => restartGame(),
    /** The live objects behind the game, for profiling one piece at a time. */
    internals: () => ({ sim, renderer, input, viewport }),
    /** Render time per frame and React commits per second, from the debug probe. */
    perf: () => ({
      averageMs: perf.average,
      worstMs: perf.worst,
      commitsPerSecond: perf.commitsPerSecond
    })
  }
  const unexpose = exposeDev('sieve', api)
  const actions: DevAction[] = [
    { label: 'Fill Sieve', run: () => sim.setSieve(sim.state.capacityMl) },
    { label: 'Drain Here', run: () => sim.drain('jolt') },
    { label: 'Finish Waits', run: () => sim.finishWaitsNow() },
    { label: '+100 Coins', run: () => sim.wallet.earn(100, 'Dev') },
    {
      label: 'Container to 90%',
      run: () => {
        const index = sim.state.containerIndex
        const def = CONTAINERS[index]
        if (def) sim.setContainer(index, def.capacityMl * 0.9)
      }
    },
    {
      label: 'Next Container',
      run: () =>
        sim.setContainer(
          Math.min(CONTAINERS.length - 1, sim.state.containerIndex + 1),
          0
        )
    },
    {
      label: 'Next Season',
      run: () => {
        const at = SEASONS.indexOf(sim.state.season)
        sim.setSeason(SEASONS[(at + 1) % SEASONS.length] ?? 'summer')
      }
    },
    { label: 'Add Hole', run: () => sim.addHoles(1) },
    {
      label: 'Buy All Upgrades',
      run: () => {
        for (const upgrade of UPGRADES) sim.buy(upgrade.id, { free: true })
      }
    },
    { label: 'Soak Slippers', run: () => soakSlippers(sim) },
    { label: 'Wear Off Wax', run: () => api.wearWax() },
    { label: 'Trigger Fly', run: () => sim.triggerEvent('fly') },
    { label: 'Trigger Leaf', run: () => sim.triggerEvent('leaf') },
    { label: 'Trigger Sneeze', run: () => sim.triggerEvent('sneeze') },
    { label: 'Trigger Dog', run: () => sim.triggerEvent('dog') },
    { label: 'Trigger Call', run: () => sim.triggerEvent('ring') },
    { label: 'Bathroom Threat', run: () => api.trigger('bathroom') },
    { label: 'Trigger Rain', run: () => sim.triggerRain() },
    { label: 'Drop Leaves', run: () => sim.dropLeaves(3) },
    { label: 'Cat Drinks', run: () => sim.triggerCat() },
    { label: 'Cat Pulls Plug', run: () => sim.triggerPlug() },
    {
      label: 'Puddle Ahead',
      run: () => {
        const w = sim.state.walker
        addPatch(sim.state.path, Math.max(2, w.distance + 8 * w.dir), 'wet')
      }
    },
    { label: 'Go to Well', run: () => sim.jumpTo('well') },
    { label: 'Go to Path', run: () => sim.jumpTo('path', { distance: 10 }) },
    { label: 'Go to House', run: () => sim.jumpTo('house') },
    {
      label: 'Go to Walk Back',
      run: () => sim.jumpTo('walkBack', { distance: 60 })
    },
    {
      // An average player: it shops, does chores and fails now and then.
      label: 'Autopilot On/Off',
      run: () => setAutopilot(game.pilot === null, { profile: 'average' })
    },
    {
      label: 'Walk for Real On/Off',
      run: () => sim.setWalkForReal(!sim.state.realWalk.on)
    },
    { label: 'Show Replay', run: () => api.openReplay() },
    { label: 'Show Ending', run: () => api.showEnding() },
    {
      // Motion mode also needs a touch press, such as from device emulation.
      label: 'Fake Phone Level On/Off',
      run: () =>
        api.fakeMotion(
          game.tilt.source instanceof FakeMotion
            ? null
            : { jolt: 0.1, tiltX: 0, tiltY: 0 }
        )
    }
  ]
  return { dispose: unexpose, actions, showEnding: api.showEnding }
}
