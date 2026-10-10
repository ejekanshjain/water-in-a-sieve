import { afterEach, describe, expect, it } from 'vitest'

import { settings } from '../shared'
import { Shake } from './fx'

describe('screen shake', () => {
  afterEach(() => settings.set({ reducedMotion: false }))

  it('shakes on a drain and settles', () => {
    const shake = new Shake()
    shake.kick(12, 300)
    expect(Math.abs(shake.offset(10, 0))).toBeGreaterThan(0)
    shake.update(300)
    expect(shake.offset(10, 0)).toBe(0)
  })

  it('stops at once when Reduced Motion turns on mid-shake', () => {
    const shake = new Shake()
    shake.kick(12, 300)
    settings.set({ reducedMotion: true })
    expect(shake.offset(10, 0)).toBe(0)
    expect(shake.offset(10, 1)).toBe(0)
  })

  it('never starts under Reduced Motion', () => {
    settings.set({ reducedMotion: true })
    const shake = new Shake()
    shake.kick(12, 300)
    settings.set({ reducedMotion: false })
    expect(shake.offset(10, 0)).toBe(0)
  })
})
