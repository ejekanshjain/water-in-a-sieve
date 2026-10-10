import { describe, expect, it } from 'vitest'

import { FixedStepper, JoltMeter } from '../shared'
import { HandMotion } from './hand'
import { POINTER_REF } from './tuning'

const STEP = 1000 / 60

/**
 * Moves a pointer along `path(t)` with events at 125 Hz, renders at `fps`, and feeds the
 * hand meter on each fixed step like the game loop. Returns the mean and peak level.
 */
function play(fps: number, path: (tMs: number) => number, ms = 4000) {
  const hand = new HandMotion()
  const meter = new JoltMeter()
  const stepper = new FixedStepper(STEP, 100)
  hand.reset(path(0), 0, 0)
  let nextEvent = 0
  let sum = 0
  let count = 0
  let peak = 0
  for (let frame = 1; frame * (1000 / fps) <= ms; frame++) {
    const t = frame * (1000 / fps)
    for (; nextEvent <= t; nextEvent += 8)
      hand.move(path(nextEvent), 0, nextEvent)
    const accel = hand.frame(t)
    const steps = stepper.advance(1000 / fps)
    for (let i = 0; i < steps; i++) {
      meter.feed(accel / POINTER_REF, STEP)
      if (t > 1000) {
        sum += meter.level
        count++
        peak = Math.max(peak, meter.level)
      }
    }
  }
  return { mean: sum / count, peak }
}

const sway = (t: number) => 40 * Math.sin((t / 1000) * Math.PI * 2)
const nervous = (t: number) => 25 * Math.sin((t / 1000) * Math.PI * 2 * 3)

describe('hand motion', () => {
  it('reads the same hand within 10% at 30, 60 and 120 fps', () => {
    for (const path of [sway, nervous]) {
      const base = play(60, path)
      for (const fps of [30, 120]) {
        const other = play(fps, path)
        expect(Math.abs(other.mean - base.mean) / base.mean).toBeLessThan(0.1)
        expect(Math.abs(other.peak - base.peak) / base.peak).toBeLessThan(0.1)
      }
    }
  })

  it('keeps a slow sway green and reads a nervous wobble higher', () => {
    expect(play(60, sway).peak).toBeLessThan(0.55)
    expect(play(60, nervous).peak).toBeGreaterThan(play(60, sway).peak * 3)
  })

  it('reads 0 for a still pointer', () => {
    const hand = new HandMotion()
    hand.reset(100, 100, 0)
    for (let t = 16; t < 1000; t += 16) {
      hand.move(100, 100, t)
      expect(hand.frame(t)).toBe(0)
    }
  })

  it('ignores bursts of events with the same timestamp', () => {
    const hand = new HandMotion()
    hand.reset(0, 0, 0)
    hand.frame(0)
    for (let i = 1; i <= 20; i++) hand.move(i * 50, 0, 5)
    expect(hand.vx).toBe(0)
    expect(hand.frame(5)).toBe(0)
  })
})
