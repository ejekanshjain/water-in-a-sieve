import { describe, expect, it } from 'vitest'

import { Autopilot, skilledPilot } from './autopilot'
import { addPatch } from './path'
import { makeSim, playWithWaits, STEP } from './testing'
import { emptyInput } from './types'

/** Plays a skilled pilot until `trips` trips have ended back at the well. */
function playTrips(name: 'average' | 'unskilled', seed: number, trips: number) {
  const game = makeSim(seed)
  const s = game.sim.state
  const pilot = new Autopilot(skilledPilot(name, seed))
  let speedSum = 0
  let speedSteps = 0
  const done = () => {
    if (s.scene === 'path' && s.phase === 'carry' && s.walker.speed > 0.5) {
      speedSum += s.walker.speed
      speedSteps++
    }
    return s.trip > trips && s.scene === 'path'
  }
  playWithWaits(game, pilot, done, 60 * 60_000)
  return { game, s, carrySpeed: speedSum / speedSteps }
}

describe('autopilot skill profiles', () => {
  it('play 10 trips as average and unskilled players with the ledger balanced', () => {
    for (const name of ['average', 'unskilled'] as const) {
      const { game, s } = playTrips(name, 3, 10)
      expect(s.trip).toBe(11)
      expect(s.stats.deliveredMl).toBeGreaterThan(2000)
      expect(game.sim.balanced()).toBe(true)
    }
  })

  it('make the unskilled player slower and more often drained', () => {
    const average = playTrips('average', 5, 30)
    const unskilled = playTrips('unskilled', 5, 30)
    expect(unskilled.carrySpeed).toBeLessThan(average.carrySpeed)
    expect(unskilled.s.stats.drains).toBeGreaterThan(average.s.stats.drains)
    // An average hand still fails some trips; nobody plays a perfect game.
    expect(average.s.stats.drains).toBeGreaterThan(0)
  })

  it('counter every carry event as an average player, after its reaction time', () => {
    for (const id of ['fly', 'leaf', 'sneeze', 'dog', 'ring'] as const) {
      for (const seed of [21, 22, 23]) {
        const game = makeSim(seed)
        const { sim } = game
        const s = sim.state
        // A fresh carry with no twitches, so only the event can spill it.
        const options = skilledPilot('average', seed)
        const skill = options.skill
        if (skill) options.skill = { ...skill, twitchesPerMin: 0 }
        const pilot = new Autopilot(options)
        sim.jumpTo('path', { distance: 30 })
        sim.triggerEvent(id)
        playWithWaits(game, pilot, () => s.event?.stage === 'over', 30_000)
        expect(s.event?.stage).toBe('over')
        expect(['countered', 'fake']).toContain(s.event?.outcome)
        expect(s.stats.drains).toBe(0)
      }
    }
  })

  it('slow down for patches on empty walks instead of falling over', () => {
    const game = makeSim(31)
    const { sim } = game
    const s = sim.state
    addPatch(s.path, 30, 'wet')
    addPatch(s.path, 60, 'ice')
    expect(sim.goToHouse()).toBe(true)
    const pilot = new Autopilot(skilledPilot('average', 31))
    const frame = emptyInput()
    let visited = false
    let slips = 0
    for (let t = 0; t < 60_000 && !(visited && s.scene === 'well'); t += STEP) {
      pilot.frame(sim, frame)
      sim.update(STEP, frame)
      for (const event of sim.events) if (event.type === 'slip') slips++
      sim.events.length = 0
      game.clock.now += STEP
      visited ||= s.scene === 'house'
    }
    expect(visited && s.scene === 'well').toBe(true)
    expect(slips).toBe(0)
  })

  it('fill a glue wait with chores: mend, glue, then shoo the cat and wipe the floor', () => {
    const game = makeSim(12)
    const { sim } = game
    const s = sim.state
    sim.setContainer(1, 5000)
    sim.addHoles(2)
    const pilot = new Autopilot(skilledPilot('average', 12))
    const glueDone = () => s.waits.glue === null && s.holes.length === 0
    const waits = playWithWaits(game, pilot, glueDone, 5 * 60_000)
    const glue = waits.find(w => w.kind === 'glue')
    expect(glue?.choresAtStart).toBeGreaterThan(0)
    expect(glue?.idleMs).toBeLessThan(10_000)
    expect(s.holes).toHaveLength(0)
  })

  it('play a whole seeded game where every wait starts with a chore and none idles 10s', () => {
    const game = makeSim(7)
    const s = game.sim.state
    const pilot = new Autopilot(skilledPilot('average', 7))
    const waits = playWithWaits(game, pilot, () => s.ended, 4 * 3600_000)
    expect(s.ended).toBe(true)
    expect(waits.length).toBeGreaterThan(10)
    for (const wait of waits) {
      expect(wait.choresAtStart).toBeGreaterThan(0)
      expect(wait.idleMs).toBeLessThan(10_000)
    }
    expect(game.sim.balanced()).toBe(true)
  }, 30_000)
})
