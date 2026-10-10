import { describe, expect, it } from 'vitest'

import { drainCaption, drainLines, litres } from './captions'
import type { LossCause } from './types'

const CAUSES: readonly LossCause[] = [
  'drip',
  'jolt',
  'bump',
  'tilt',
  'letGo',
  'fly',
  'leaves',
  'sneeze',
  'dog',
  'ring',
  'ice',
  'wetFloor',
  'splash',
  'swat',
  'cat'
]

/** A mid-path drain with plenty lost, so only the rotation and the stat lines speak. */
function facts(count: number, lostMl = 30_000) {
  return { count, lostMl, pathMetres: 50 }
}

describe('drain captions', () => {
  it('has at least 6 distinct lines per cause, in plain punctuation', () => {
    for (const cause of CAUSES) {
      const lines = drainLines(cause)
      expect(new Set(lines).size).toBeGreaterThanOrEqual(6)
      for (const line of lines) expect(line).not.toMatch(/\.\.\.|—|[“”]/)
    }
  })

  it('never repeats a caption back to back, and every line gets its turn', () => {
    for (const cause of CAUSES) {
      const seen = new Set<string>()
      let last = ''
      for (let count = 0; count < 18; count++) {
        const line = drainCaption(cause, facts(count))
        expect(line).not.toBe(last)
        last = line
        seen.add(line)
      }
      for (const line of drainLines(cause)) expect(seen).toContain(line)
    }
  })

  it('quotes your stats every third drain of a cause', () => {
    expect(drainCaption('fly', facts(2))).toBe('Third fly today.')
    expect(drainCaption('dog', facts(5, 12_000))).toBe(
      "That's 12 L to the dog."
    )
    // Not enough lost to be worth adding up yet: it counts instead.
    expect(drainCaption('dog', facts(5, 1_500))).toBe(
      'Sixth time the dog got you.'
    )
    expect(drainCaption('fly', facts(11, 0))).toBe('12th fly today.')
  })

  it('mocks a drain in the first 10 m', () => {
    expect(
      drainCaption('bump', { count: 0, lostMl: 800, pathMetres: 8.4 })
    ).toBe('8 m. Eight.')
    // Not on the next one, and never in the house.
    expect(
      drainCaption('bump', { count: 1, lostMl: 1600, pathMetres: 8.4 })
    ).not.toMatch(/Eight/)
    expect(
      drainCaption('cat', { count: 0, lostMl: 800, pathMetres: null })
    ).toBe('The cat. Obviously.')
  })

  it('formats litres with one decimal under 10 L and none above', () => {
    expect(litres(800)).toBe('0.8 L')
    expect(litres(3000)).toBe('3 L')
    expect(litres(12_400)).toBe('12 L')
  })
})
