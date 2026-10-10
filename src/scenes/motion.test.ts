import { describe, expect, it } from 'vitest'

import { FakeMotion, PhoneTilt } from './motion'

const STEP = 1000 / 60

function hold(tilt: PhoneTilt, ms: number): boolean {
  let calibrated = false
  for (let t = 0; t < ms; t += STEP) calibrated = tilt.step(STEP) || calibrated
  return calibrated
}

function setup(rawX = 0, rawY = 0) {
  const fake = new FakeMotion()
  fake.rawX = rawX
  fake.rawY = rawY
  const tilt = new PhoneTilt()
  tilt.setSource(fake)
  return { fake, tilt }
}

describe('phone tilt calibration', () => {
  it('levels a tray pose once the phone is still for half a second', () => {
    const { tilt } = setup(5, 20)
    tilt.request('tray')
    expect(hold(tilt, 400)).toBe(false)
    expect(hold(tilt, 300)).toBe(true)
    expect(tilt.calibrated).toBe(true)
    expect(tilt.tiltX).toBeCloseTo(0)
    expect(tilt.tiltY).toBeCloseTo(0)
    expect(tilt.status).toBe('idle')
  })

  it('refuses a pose more than 45° from flat', () => {
    const { fake, tilt } = setup(0, 60)
    tilt.request('tray')
    expect(hold(tilt, 2000)).toBe(false)
    expect(tilt.status).toBe('flatter')
    expect(tilt.calibrateNow()).toBe(false)
    fake.rawY = 30
    expect(hold(tilt, 700)).toBe(true)
  })

  it('waits while the phone moves', () => {
    const { fake, tilt } = setup()
    tilt.request('tray')
    fake.jolt = 2
    expect(hold(tilt, 2000)).toBe(false)
    expect(tilt.status).toBe('moving')
    fake.jolt = 0.1
    expect(hold(tilt, 700)).toBe(true)
  })

  it('remembers the raw pose across calibrations, so flatness stays honest', () => {
    const { fake, tilt } = setup(0, 30)
    tilt.calibrateNow()
    fake.rawY = 40
    expect(tilt.tiltY).toBeCloseTo(10)
    expect(tilt.fromFlat).toBeCloseTo(40)
    tilt.calibrateNow()
    fake.rawY = 50
    expect(tilt.tiltY).toBeCloseTo(10)
    expect(tilt.fromFlat).toBeCloseTo(50)
    expect(tilt.calibrateNow()).toBe(false)
  })

  it('only nudges level by a few degrees after a crank, and gives up quietly', () => {
    const { fake, tilt } = setup()
    tilt.calibrateNow()
    fake.rawY = -25
    tilt.request('refine')
    expect(hold(tilt, 5000)).toBe(false)
    expect(tilt.wanted).toBeNull()
    expect(tilt.tiltY).toBeCloseTo(-25)
    fake.rawY = 6
    tilt.request('refine')
    expect(hold(tilt, 700)).toBe(true)
    expect(tilt.tiltY).toBeCloseTo(0)
  })
})
