import { describe, expect, it } from 'vitest'

import { pointerPour, pourFlow, splashFraction, stepKeyPour } from './pour'
import { gripFrame, hold, makeSim, runPilot, STEP } from './testing'

/** Plays until the pour starts and returns the game and a frame at the pour anchor. */
function atPour(seed: number) {
  const game = makeSim(seed)
  runPilot(game, () => game.sim.state.phase === 'pour')
  const s = game.sim.state
  return { game, frame: gripFrame(s.house.pourAnchorX, s.grip.y) }
}

describe('pour rules', () => {
  it('flows from 0 at the start of the axis to 2 L/s at full tilt', () => {
    expect(pourFlow(0.15)).toBe(0)
    expect(pourFlow(1)).toBe(2)
    expect(pourFlow(0.5)).toBeGreaterThan(pourFlow(0.4))
  })

  it('splashes nothing up to 0.6 L/s and at most 70%', () => {
    expect(splashFraction(0.6)).toBe(0)
    expect(splashFraction(1.3)).toBeCloseTo(0.5)
    expect(splashFraction(2)).toBe(0.7)
  })

  it('reads the pointer from the anchor taken when the pour began', () => {
    expect(pointerPour(160, 100)).toBeCloseTo(0.5)
    expect(pointerPour(40, 100)).toBe(0)
  })

  it('raises the key pour slowly with D, holds it, and lowers it with A', () => {
    let value = 0
    for (let t = 0; t < 1000; t += STEP) value = stepKeyPour(value, 1, STEP)
    expect(value).toBeCloseTo(0.5, 1)
    expect(stepKeyPour(value, 0, STEP)).toBe(value)
    for (let t = 0; t < 600; t += STEP) value = stepKeyPour(value, -1, STEP)
    expect(value).toBe(0)
  })
})

describe('pouring in the house', () => {
  it('pours 55 units right of the anchor with no dribble and no splash', () => {
    const { game, frame } = atPour(21)
    frame.x += 55
    hold(game, frame, 2500)
    const s = game.sim.state
    expect(s.phase).toBe('poured')
    expect(s.sieve.splashed).toBe(0)
    expect(s.current.noDrip).toBe('intact')
    expect(game.sim.balanced()).toBe(true)
  })

  it('keeps a held D in the green band once released', () => {
    const { game, frame } = atPour(22)
    frame.pour = 1
    hold(game, frame, 900)
    frame.pour = 0
    hold(game, frame, 200)
    const house = game.sim.state.house
    expect(house.flow).toBeGreaterThan(0.3)
    expect(house.flow).toBeLessThanOrEqual(0.6)
    hold(game, frame, 4000)
    expect(game.sim.state.sieve.splashed).toBe(0)
  })

  it('splashes a fast pour and pays less', () => {
    const slow = atPour(23)
    slow.frame.x += 50
    hold(slow.game, slow.frame, 4000)
    const fast = atPour(23)
    fast.frame.x += 120
    hold(fast.game, fast.frame, 4000)
    expect(fast.game.sim.state.sieve.splashed).toBeGreaterThan(100)
    expect(fast.game.sim.wallet.coins()).toBeLessThan(
      slow.game.sim.wallet.coins()
    )
    expect(fast.game.sim.state.house.floorPatch).toBe(true)
  })

  it('dumps 40% in and 60% out when you let go mid-pour', () => {
    const { game, frame } = atPour(24)
    const water = game.sim.state.sieve.inSieve
    frame.grip = false
    frame.release = 'letGo'
    game.sim.update(STEP, frame)
    const s = game.sim.state
    expect(s.phase).toBe('poured')
    expect(s.containers[0]?.inContainer).toBe(Math.floor(water * 0.4))
    expect(s.sieve.inSieve).toBe(0)
    expect(game.sim.balanced()).toBe(true)
  })

  it('stops the pour when the container fills, and the rest drips away uncounted', () => {
    const { game, frame } = atPour(25)
    const s = game.sim.state
    const bucket = s.containers[0]
    if (!bucket) throw new Error('no bucket')
    bucket.inContainer = bucket.delivered = 9_900
    const badge = s.current.noDrip
    frame.x += 50
    hold(game, frame, 600)
    expect(bucket.inContainer).toBe(10_000)
    expect(bucket.done).toBe(true)
    expect(s.phase).toBe('poured')
    expect(s.sieve.inSieve).toBe(0)
    expect(s.sieve.splashed).toBeLessThan(15)
    expect(s.current.noDrip).toBe(badge)
    expect(game.sim.balanced()).toBe(true)
  })
})
