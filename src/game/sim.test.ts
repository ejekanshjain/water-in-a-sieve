import { afterEach, describe, expect, it } from 'vitest'

import { settings } from '../shared'
import { Autopilot } from './autopilot'
import { hintFor } from './hints'
import { hold, makeSim, runPilot as autopilot, STEP } from './testing'
import {
  COLD_OPEN_MS,
  HAND_ASSIST_SCALE,
  SIEVE_HOVER_Y,
  SLOSH_LEVEL
} from './tuning'
import { emptyInput } from './types'

describe('sim', () => {
  it('lets the autopilot crank, scoop, carry and run back, keeping the ledger balanced', () => {
    const game = makeSim(4)
    const { sim } = game
    expect(sim.state.scene).toBe('well')
    autopilot(game, () => sim.state.phase === 'poured')
    expect(sim.state.trip).toBe(1)
    expect(sim.state.well.scoopsLeft).toBe(4)
    const delivered = sim.state.sieve.delivered
    expect(delivered).toBeGreaterThan(700)
    expect(delivered).toBeLessThan(850)
    expect(sim.state.sieve.drained).toBe(0)
    expect(sim.state.containers[0]?.inContainer).toBe(delivered)
    // A clean first trip earns the No-Drip bonus without wax.
    expect(sim.state.current.noDrip).toBe('intact')
    expect(sim.wallet.coins()).toBe(Math.round(delivered / 100) + 10)
    autopilot(game, () => sim.state.scene === 'well')
    expect(sim.state.tripReport).toMatch(
      /^0\.\d L\. The bucket is \d+% full\.$/
    )
    expect(sim.balanced()).toBe(true)
  })

  it('steers against drift on trip 2 and still delivers', () => {
    const game = makeSim(5)
    const { sim } = game
    autopilot(game, () => sim.state.trip === 2)
    autopilot(game, () => sim.state.phase === 'poured')
    expect(sim.state.trip).toBe(2)
    expect(sim.state.stats.drains).toBe(0)
    expect(sim.balanced()).toBe(true)
  })

  it('drains on a flick with cause jolt, then walks back from there', () => {
    const game = makeSim(6)
    const { sim } = game
    autopilot(game, () => sim.state.walker.distance > 30)
    autopilot(
      game,
      () => sim.state.phase === 'drained',
      1000,
      frame => {
        frame.handAccel = 40_000
      }
    )
    expect(sim.state.lastDrain?.cause).toBe('jolt')
    const at = sim.state.lastDrain?.distance ?? 0
    expect(at).toBeGreaterThan(30)
    autopilot(game, () => sim.state.scene === 'walkBack')
    expect(sim.state.walker.distance).toBeCloseTo(at, 0)
    expect(sim.balanced()).toBe(true)
  })

  it('drains a jerky lift at the well, and the scoop still counts', () => {
    const game = makeSim(7)
    const { sim } = game
    autopilot(game, () => sim.state.phase === 'scoop')
    autopilot(
      game,
      () => sim.state.stats.drains > 0,
      5000,
      frame => {
        // Yank the sieve once it is full and out of the water.
        if (sim.state.sieve.inSieve > 900 && !sim.state.well.dipped)
          frame.handAccel = 30_000
      }
    )
    expect(sim.state.scene).toBe('well')
    expect(sim.state.lastDrain?.scene).toBe('well')
    expect(sim.state.well.scoopsLeft).toBe(4)
    expect(sim.balanced()).toBe(true)
  })

  it('keeps the tilt continuous when the scoop hands over to the path', () => {
    const game = makeSim(8)
    const { sim } = game
    let before = -1
    autopilot(
      game,
      () => sim.state.scene === 'path',
      20_000,
      frame => {
        // Hold the sieve 20 units to the side: 6 degrees.
        if (sim.state.grip.held) frame.x = sim.state.grip.anchorX + 20
        if (sim.state.scene === 'well') before = sim.state.tiltDeg
      }
    )
    const frame = emptyInput()
    new Autopilot().frame(sim, frame)
    frame.x += 20
    sim.update(STEP, frame)
    expect(before).toBeCloseTo(6, 1)
    expect(sim.state.tiltDeg).toBeCloseTo(before, 1)
  })

  it('catches a 150 ms let-go and drains a 250 ms one', () => {
    for (const [gapMs, drains] of [
      [150, false],
      [250, true]
    ] as const) {
      const game = makeSim(9)
      const { sim } = game
      autopilot(game, () => sim.state.walker.distance > 10)
      const frame = emptyInput()
      new Autopilot().frame(sim, frame)
      frame.grip = false
      frame.release = 'letGo'
      sim.update(STEP, frame)
      frame.release = 'none'
      for (let t = STEP; t < gapMs; t += STEP) sim.update(STEP, frame)
      if (sim.state.phase === 'carry') {
        new Autopilot().frame(sim, frame)
        frame.gripPressed = true
        sim.update(STEP, frame)
      }
      expect(sim.state.phase === 'drained').toBe(drains)
      if (drains) expect(sim.state.lastDrain?.cause).toBe('letGo')
      else expect(sim.state.grip.held).toBe(true)
    }
  })

  it('pauses on a blur release instead of tipping, then resumes after a fresh grip', () => {
    const game = makeSim(10)
    const { sim } = game
    autopilot(game, () => sim.state.walker.distance > 10)
    const water = sim.state.sieve.inSieve
    const frame = emptyInput()
    frame.release = 'pause'
    sim.update(STEP, frame)
    frame.release = 'none'
    for (let i = 0; i < 120; i++) sim.update(STEP, frame)
    expect(sim.state.paused).toBe(true)
    expect(sim.state.sieve.inSieve).toBe(water)
    autopilot(game, () => sim.state.holdStillMs > 0, 100)
    expect(sim.state.paused).toBe(false)
    autopilot(game, () => sim.state.phase === 'poured')
    expect(sim.state.stats.drains).toBe(0)
  })

  it('keeps the sieve offset when you re-grab somewhere else', () => {
    const game = makeSim(11)
    const { sim } = game
    autopilot(game, () => sim.state.walker.distance > 5)
    const frame = emptyInput()
    new Autopilot().frame(sim, frame)
    frame.x += 20
    sim.update(STEP, frame)
    const before = sim.state.grip.offsetX
    frame.release = 'pause'
    sim.update(STEP, frame)
    frame.release = 'none'
    frame.gripPressed = true
    frame.x += 300
    sim.update(STEP, frame)
    frame.gripPressed = false
    sim.update(STEP, frame)
    expect(sim.state.grip.offsetX).toBeCloseTo(before, 0)
  })

  it('hangs an empty sieve back on its hook when you let go at the well', () => {
    const game = makeSim(12)
    const { sim } = game
    autopilot(game, () => sim.state.phase === 'scoop')
    const frame = emptyInput()
    frame.grip = true
    frame.gripPressed = true
    frame.x = 270
    frame.y = 500
    sim.update(STEP, frame)
    frame.gripPressed = false
    frame.y = 480
    sim.update(STEP, frame)
    expect(sim.state.well.sieveY).toBeLessThan(SIEVE_HOVER_Y)
    frame.grip = false
    frame.release = 'letGo'
    sim.update(STEP, frame)
    expect(sim.state.well.sieveY).toBe(SIEVE_HOVER_Y)
    expect(sim.state.stats.drains).toBe(0)
  })

  it('picks the sieve up again at the well when the button stayed down on the walk back', () => {
    const game = makeSim(6)
    const { sim } = game
    autopilot(game, () => sim.state.walker.distance > 30)
    sim.drain('jolt')
    const frame = emptyInput()
    frame.grip = true
    frame.gripId = 1
    frame.walk = true
    frame.x = 270
    frame.y = 330
    autopilot(
      game,
      () => sim.state.scene === 'well',
      30_000,
      f => {
        Object.assign(f, frame)
      }
    )
    frame.walk = false
    hold(game, frame, STEP)
    expect(sim.state.grip.held).toBe(true)
    // Dragging down with the same press now moves the sieve toward the water.
    frame.y += 60
    hold(game, frame, STEP)
    expect(sim.state.well.sieveY).toBeCloseTo(SIEVE_HOVER_Y + 60, 0)
  })
})

describe('start, pause and hints', () => {
  afterEach(() => settings.set({ assist: false }))

  it('plays the cold open for 8s, then hands over to the well', () => {
    const game = makeSim(30)
    const { sim } = game
    sim.startColdOpen()
    expect(sim.state.scene).toBe('cutscene')
    hold(game, emptyInput(), COLD_OPEN_MS - 100)
    expect(sim.state.scene).toBe('cutscene')
    hold(game, emptyInput(), 200)
    expect(sim.state.scene).toBe('well')
    expect(sim.state.phase).toBe('crank')
  })

  it('skips the cold open on a tap without gripping anything', () => {
    const game = makeSim(31)
    const { sim } = game
    sim.startColdOpen()
    hold(game, emptyInput(), 1000)
    const tap = emptyInput()
    tap.grip = true
    tap.gripPressed = true
    sim.update(STEP, tap)
    expect(sim.state.scene).toBe('well')
    expect(sim.state.grip.held).toBe(false)
  })

  it('resumes a paused walk back on the next press', () => {
    const game = makeSim(32)
    const { sim } = game
    autopilot(game, () => sim.state.scene === 'walkBack')
    sim.pause()
    const press = emptyInput()
    press.walk = true
    hold(game, press, 500)
    expect(sim.state.paused).toBe(true)
    const at = sim.state.walker.distance
    press.gripPressed = true
    sim.update(STEP, press)
    press.gripPressed = false
    hold(game, press, 500)
    expect(sim.state.paused).toBe(false)
    expect(sim.state.holdStillMs).toBe(0)
    expect(sim.state.walker.distance).toBeLessThan(at)
  })

  it('carries on when a dialog closes, unless water is in your hands', () => {
    const game = makeSim(33)
    const { sim } = game
    sim.pause()
    sim.resume()
    expect(sim.state.paused).toBe(false)
    autopilot(game, () => sim.state.walker.distance > 10)
    const water = sim.state.sieve.inSieve
    sim.pause()
    sim.resume()
    expect(sim.state.paused).toBe(true)
    hold(game, emptyInput(), 2000)
    expect(sim.state.sieve.inSieve).toBe(water)
    expect(sim.state.stats.drains).toBe(0)
  })

  it('reads the same flick softer in Assist Mode, but an 8 m/s bump still drains', () => {
    const flick = (assist: boolean) => {
      settings.set({ assist })
      const game = makeSim(34)
      const s = game.sim.state
      autopilot(game, () => s.walker.distance > 5)
      let steps = 0
      let early = 0
      autopilot(
        game,
        () => steps >= 10 || s.phase !== 'carry',
        1000,
        frame => {
          frame.handAccel = 6600
          frame.walk = false
          // Compare both hands a few steps in, before either drains.
          if (steps === 2) early = s.steady.hand
          steps++
        }
      )
      return { early, drained: s.lastDrain?.cause ?? null }
    }
    const plain = flick(false)
    const assisted = flick(true)
    expect(plain.drained).toBe('jolt')
    expect(assisted.drained).toBeNull()
    expect(assisted.early / plain.early).toBeCloseTo(HAND_ASSIST_SCALE, 1)

    // The body level ignores Sensitivity and only softens a little in Assist Mode.
    settings.set({ assist: true, sensitivity: 0.5 })
    const game = makeSim(35)
    const s = game.sim.state
    autopilot(game, () => s.scene === 'path')
    s.path.bumps = [70]
    s.path.moles = [false]
    autopilot(
      game,
      () => s.phase !== 'carry',
      30_000,
      frame => {
        frame.walk = true
      }
    )
    settings.set({ sensitivity: 1 })
    expect(s.lastDrain?.cause).toBe('bump')
    expect(s.lastDrain?.distance).toBeGreaterThanOrEqual(70)
  })

  it('suggests Assist Mode once after 4 drains in a row, and a delivery resets the count', () => {
    const game = makeSim(36)
    const { sim } = game
    const suggestions = () =>
      sim.events.filter(e => e.type === 'suggestAssist').length
    const drainTrip = () => {
      autopilot(game, () => sim.state.scene === 'path')
      sim.drain('jolt')
      autopilot(game, () => sim.state.scene === 'well')
    }
    for (let i = 0; i < 3; i++) drainTrip()
    autopilot(game, () => sim.state.phase === 'poured')
    expect(sim.state.drainStreak).toBe(0)
    for (let i = 0; i < 3; i++) drainTrip()
    expect(suggestions()).toBe(0)
    drainTrip()
    expect(suggestions()).toBe(1)
    drainTrip()
    expect(suggestions()).toBe(1)
  })

  it('teaches arm fatigue after 15s of carrying and drift on trip 2, once each', () => {
    const game = makeSim(37)
    const { sim } = game
    const s = sim.state
    autopilot(game, () => s.scene === 'path' && s.carryMs > 15_500)
    expect(s.trip).toBe(1)
    expect(hintFor(s, 'mouse')).toBe('Arms. Going. Hurry up.')
    autopilot(game, () => s.trip === 2 && s.walker.distance > 30)
    expect(s.hintsDone.fatigue).toBe(true)
    expect(hintFor(s, 'mouse')).toBe('The sieve wanders. Keep it on the dot.')
    autopilot(game, () => s.trip === 3 && s.walker.distance > 30)
    expect(s.hintsDone.drift).toBe(true)
    expect(hintFor(s, 'mouse')).toBeNull()
  })
})

describe('dev jumps', () => {
  it('jump to each scene with the ledger balanced', () => {
    const game = makeSim(9)
    const { sim } = game
    const s = sim.state
    sim.jumpTo('path', { distance: 50 })
    expect([s.scene, s.phase, s.walker.distance]).toEqual(['path', 'carry', 50])
    expect(s.sieve.inSieve).toBe(s.capacityMl)
    expect(s.grip.held).toBe(true)
    sim.jumpTo('house')
    expect([s.scene, s.phase]).toEqual(['house', 'enter'])
    sim.jumpTo('house', { full: false })
    expect([s.scene, s.phase, s.sieve.inSieve]).toEqual(['house', 'visit', 0])
    sim.jumpTo('walkBack', { distance: 60 })
    expect([s.scene, s.phase, s.walker.distance]).toEqual([
      'walkBack',
      'return',
      60
    ])
    sim.jumpTo('well')
    expect(s.scene).toBe('well')
    // Play on from a jump: the trip carries on to the house.
    sim.jumpTo('path', { distance: 90 })
    autopilot(game, () => s.scene === 'house', 20_000)
    expect(s.scene).toBe('house')
    expect(sim.balanced()).toBe(true)
  })
})

describe('phone motion mode', () => {
  /** A motion frame: the phone is the grip, so it is always held. */
  function phone() {
    const frame = emptyInput()
    frame.mode = 'motion'
    frame.grip = true
    return frame
  }

  /** Cranks with the autopilot, then scoops with tilts and lifts onto the path. */
  function scoopByTilt(seed: number) {
    const game = makeSim(seed)
    const s = game.sim.state
    autopilot(game, () => s.phase === 'scoop')
    const frame = phone()
    frame.tiltY = -30
    hold(game, frame, 300)
    expect(s.well.dipped).toBe(true)
    hold(game, frame, 1200)
    const scooped = s.sieve.inSieve
    // Tip back: the sieve rises slowly out of the bucket and onto the path.
    frame.tiltY = 0
    hold(game, frame, 2500)
    return { game, s, scooped, frame }
  }

  it('dips the sieve when tipped forward past 25° and lifts it when tipped back', () => {
    const { s, scooped } = scoopByTilt(40)
    expect(scooped).toBeGreaterThan(900)
    expect(s.scene).toBe('path')
    expect(s.sieve.inSieve).toBeGreaterThan(850)
    expect(s.stats.drains).toBe(0)
  })

  it('dribbles at a 20° tilt and drains on a 5 m/s² jolt', () => {
    const { game, s, frame } = scoopByTilt(41)
    frame.tiltX = 20
    const before = s.sieve.inSieve
    hold(game, frame, 1000)
    expect(s.dribbling).toBe(true)
    expect(s.tiltDeg).toBeCloseTo(20)
    expect(before - s.sieve.inSieve).toBeGreaterThan(20)
    expect(s.current.noDrip).not.toBe('intact')
    frame.tiltX = 0
    frame.motionJolt = 5
    hold(game, frame, 300)
    expect(s.lastDrain?.cause).toBe('jolt')
  })

  it('carries with no game drift, walks only on a thumb, and runs back the same way', () => {
    const { game, s, frame } = scoopByTilt(42)
    s.trip = 2
    hold(game, frame, 3000)
    expect(s.walker.distance).toBe(0)
    expect(s.grip.offsetX).toBe(0)
    frame.walk = true
    hold(game, frame, 3000)
    expect(s.walker.distance).toBeGreaterThan(3)
    game.sim.drain('jolt')
    frame.walk = false
    hold(game, frame, 2500)
    expect(s.scene).toBe('walkBack')
    const at = s.walker.distance
    hold(game, frame, 1000)
    expect(s.walker.distance).toBeCloseTo(at)
    frame.walk = true
    hold(game, frame, 1000)
    expect(s.walker.distance).toBeLessThan(at)
  })

  /** One real footstep: the phone jolts to `peak` for 120 ms, then rests until `everyMs`. */
  function footstep(
    game: ReturnType<typeof makeSim>,
    frame: ReturnType<typeof phone>,
    peak: number,
    everyMs = 550
  ) {
    let top = 0
    for (let t = 0; t < everyMs; t += STEP) {
      frame.motionJolt = t < 120 ? peak : 0.1
      game.sim.update(STEP, frame)
      game.clock.now += STEP
      top = Math.max(top, game.sim.state.steady.total)
    }
    return top
  }

  it('walks for real: 50 gentle steps walk 100 m in the green, and thumbs stay still', () => {
    const { game, s, frame } = scoopByTilt(44)
    game.sim.setWalkForReal(true)
    s.path.bumps.length = 0
    frame.walk = true
    hold(game, frame, 1000)
    expect(s.walker.distance).toBe(0)
    frame.walk = false
    let top = 0
    for (let i = 0; i < 49; i++) top = Math.max(top, footstep(game, frame, 2))
    expect(s.scene).toBe('path')
    expect(s.walker.distance).toBeGreaterThan(95)
    expect(s.realWalk.steps).toBe(49)
    footstep(game, frame, 2)
    hold(game, frame, 600)
    expect(s.scene).toBe('house')
    // Two more steps walk the 4 m to the bucket.
    footstep(game, frame, 1.5)
    footstep(game, frame, 1.5)
    hold(game, frame, 600)
    expect(s.phase).toBe('pour')
    expect(top).toBeLessThan(SLOSH_LEVEL)
    expect(s.stats.drains).toBe(0)
    expect(game.sim.balanced()).toBe(true)
  })

  it('drains on a stomp with cause stomp, and real steps run you back', () => {
    const { game, s, frame } = scoopByTilt(45)
    game.sim.setWalkForReal(true)
    for (let i = 0; i < 5; i++) footstep(game, frame, 1.5)
    expect(s.stats.drains).toBe(0)
    footstep(game, frame, 4)
    expect(s.lastDrain?.cause).toBe('stomp')
    hold(game, frame, 2500)
    expect(s.scene).toBe('walkBack')
    const at = s.walker.distance
    for (let i = 0; i < 4; i++) footstep(game, frame, 1.5)
    expect(s.walker.distance).toBeLessThan(at - 5)
    expect(game.sim.balanced()).toBe(true)
  })

  it('offers Walk for Real on Last Trip, as the context button', () => {
    const { game, s } = scoopByTilt(46)
    expect(game.sim.contextAction()).toBeNull()
    game.sim.setContainer(2, 99_500)
    // By the Last Trip, the first-time carry hints are long done.
    s.hintsDone.walk = s.hintsDone.noDrip = true
    expect(game.sim.contextAction()).toBe('realWalk')
    expect(game.sim.hint('motion')).toBe(
      'Last trip. Walk it for real? Tap Walk for Real.'
    )
    game.sim.doContext()
    expect(s.realWalk.on).toBe(true)
    expect(game.sim.contextAction()).toBeNull()
  })

  it('pauses when a mouse takes over mid-carry, and a fresh click carries on from the same tilt', () => {
    const { game, s, frame } = scoopByTilt(45)
    frame.tiltX = 2
    hold(game, frame, 500)
    const water = s.sieve.inSieve
    const offset = s.grip.offsetX
    // A mouse brushes the screen far from where the sieve sits.
    const mouse = emptyInput()
    mouse.x = 500
    mouse.y = 100
    hold(game, mouse, 1000)
    expect(s.paused).toBe(true)
    expect(s.sieve.inSieve).toBe(water)
    expect(hintFor(s, 'mouse', { atStake: true })).toMatch(
      /mouse or pen took over/
    )
    mouse.grip = true
    mouse.gripId = 1
    mouse.gripPressed = true
    game.sim.update(STEP, mouse)
    mouse.gripPressed = false
    expect(s.holdStillMs).toBeGreaterThan(0)
    hold(game, mouse, 1500)
    expect(s.paused).toBe(false)
    expect(s.grip.offsetX).toBeCloseTo(offset, 0)
    expect(s.tiltDeg).toBeLessThan(3)
    expect(s.stats.drains).toBe(0)
  })

  it('never resumes on the tap that switches to tilt, and switches freely with nothing at stake', () => {
    const game = makeSim(46)
    const s = game.sim.state
    autopilot(game, () => s.walker.distance > 10)
    const tap = phone()
    tap.gripPressed = true
    game.sim.update(STEP, tap)
    tap.gripPressed = false
    hold(game, tap, 500)
    expect(s.paused).toBe(true)
    expect(s.stats.drains).toBe(0)
    tap.gripPressed = true
    game.sim.update(STEP, tap)
    expect(s.paused).toBe(false)
    expect(s.holdStillMs).toBeGreaterThan(0)
    // At the well with an empty sieve, a new input takes over without a pause.
    const empty = makeSim(47)
    autopilot(empty, () => empty.sim.state.phase === 'scoop')
    hold(empty, phone(), 100)
    expect(empty.sim.state.paused).toBe(false)
    expect(empty.sim.state.grip.held).toBe(true)
  })

  it('pours by tilting right', () => {
    const { game, s, frame } = scoopByTilt(43)
    frame.walk = true
    autopilot(
      game,
      () => s.phase === 'pour',
      60_000,
      f => {
        Object.assign(f, frame)
        f.walk = s.walker.speed < 4
      }
    )
    frame.walk = false
    frame.tiltX = 10
    hold(game, frame, 3000)
    expect(s.phase).toBe('poured')
    expect(s.current.splashedMl).toBe(0)
    expect(s.containers[0]?.inContainer).toBeGreaterThan(700)
  })
})
