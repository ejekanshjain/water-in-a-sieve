import { describe, expect, it } from 'vitest'

import { rng } from '../shared'
import {
  addWater,
  createLedger,
  isBalanced,
  leak,
  move,
  moveAll,
  type OutChannel
} from './ledger'

describe('sieve ledger', () => {
  it('carries fractions until they make a whole mL', () => {
    const ledger = createLedger()
    addWater(ledger, 1000)
    let moved = 0
    for (let i = 0; i < 10; i++) moved += leak(ledger, 'dripped', 0.25)
    expect(moved).toBe(2)
    expect(ledger.dripped).toBe(2)
    expect(ledger.rem.dripped).toBeCloseTo(0.5)
    expect(isBalanced(ledger)).toBe(true)
  })

  it('clamps leaks to the water left', () => {
    const ledger = createLedger()
    addWater(ledger, 3)
    expect(leak(ledger, 'drained', 50)).toBe(3)
    expect(ledger.inSieve).toBe(0)
    expect(leak(ledger, 'dripped', 5)).toBe(0)
    expect(isBalanced(ledger)).toBe(true)
  })

  it('caps scooping at the given capacity', () => {
    const ledger = createLedger()
    expect(addWater(ledger, 1500.7, 1000)).toBe(1000)
    expect(addWater(ledger, 20, 1000)).toBe(0)
    expect(ledger.scooped).toBe(1000)
  })

  it('moves everything at once on a break', () => {
    const ledger = createLedger()
    addWater(ledger, 812)
    leak(ledger, 'dripped', 0.6)
    expect(moveAll(ledger, 'drained')).toBe(812)
    expect(ledger.rem.dripped).toBe(0)
    expect(isBalanced(ledger)).toBe(true)
  })

  it('keeps the invariant exact over 10,000 random operations', () => {
    const random = rng(7)
    const ledger = createLedger()
    const channels: OutChannel[] = [
      'delivered',
      'drained',
      'dripped',
      'splashed'
    ]
    for (let i = 0; i < 10_000; i++) {
      const roll = random()
      const channel = channels[Math.floor(random() * 4)] ?? 'dripped'
      if (roll < 0.3) addWater(ledger, random() * 400, 3000)
      else if (roll < 0.85) leak(ledger, channel, random() * 3)
      else if (roll < 0.95) move(ledger, channel, random() * 200)
      else moveAll(ledger, channel)
      expect(isBalanced(ledger)).toBe(true)
    }
  })
})
