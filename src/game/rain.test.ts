import { describe, expect, it } from 'vitest'

import { createContainers } from './containers'
import { createRain, rainGag, startRain, stepRain } from './rain'
import { makeSim, runPilot, STEP } from './testing'

describe('spring rain', () => {
  it('fills the tub for 10s, then drains back to exactly what was there', () => {
    const [, , tub] = createContainers()
    if (!tub) throw new Error('no tub')
    tub.inContainer = tub.delivered = 62_000
    const rain = createRain()
    startRain(rain)
    let peak = 0
    let gone = false
    for (let t = 0; t < 30_000 && !gone; t += STEP) {
      gone = stepRain(rain, tub, STEP) === 'gone'
      peak = Math.max(peak, tub.rainMl)
    }
    expect(gone).toBe(true)
    expect(peak).toBeGreaterThan(2_900)
    expect(peak).toBeLessThanOrEqual(3_000)
    expect(tub.rainMl).toBe(0)
    expect(tub.inContainer).toBe(62_000)
  })

  it('escalates: plain, an umbrella that keeps it out, catching it, then rainbows', () => {
    expect([1, 2, 3, 4, 9].map(rainGag)).toEqual([
      'plain',
      'umbrella',
      'scoop',
      'rainbow',
      'rainbow'
    ])
    const [, , tub] = createContainers()
    if (!tub) throw new Error('no tub')
    const rain = createRain()
    startRain(rain)
    rain.stage = 'dry'
    startRain(rain)
    expect(rain.gag).toBe('umbrella')
    for (let t = 0; t < 5_000; t += STEP) stepRain(rain, tub, STEP)
    expect(tub.rainMl).toBe(0)
  })

  it('always comes on the first spring arrival at the house', () => {
    const game = makeSim(87)
    const { sim } = game
    sim.setContainer(2, 61_000)
    expect(sim.state.season).toBe('spring')
    runPilot(game, () => sim.state.scene === 'house', 120_000)
    expect(sim.state.rain.count).toBe(1)
    expect(sim.state.rain.stage).toBe('falling')
    const before = sim.state.containers[2]?.inContainer ?? 0
    runPilot(game, () => sim.state.rain.stage === 'dry', 60_000)
    expect(sim.state.containers[2]?.rainMl).toBe(0)
    // Only your own pour stays in the tub.
    expect(sim.state.containers[2]?.inContainer).toBeGreaterThanOrEqual(before)
  })
})
