/**
 * The water ledger. Every millilitre that enters or leaves the sieve moves through here,
 * in whole mL, so `scooped === inSieve + delivered + drained + dripped + splashed` holds
 * exactly. Fractions wait in per-channel remainders until they add up to a whole mL.
 */

/** Where water can go when it leaves the sieve. */
export type OutChannel = 'delivered' | 'drained' | 'dripped' | 'splashed'

export interface SieveLedger {
  scooped: number
  inSieve: number
  delivered: number
  drained: number
  dripped: number
  splashed: number
  /** Fractions of a mL waiting to move, per channel. */
  rem: Record<OutChannel | 'scooped', number>
}

export function createLedger(): SieveLedger {
  return {
    scooped: 0,
    inSieve: 0,
    delivered: 0,
    drained: 0,
    dripped: 0,
    splashed: 0,
    rem: { scooped: 0, delivered: 0, drained: 0, dripped: 0, splashed: 0 }
  }
}

/**
 * Adds scooped water, up to `maxInSieve`. Returns the whole mL added.
 * Fractions carry over to the next call.
 */
export function addWater(
  ledger: SieveLedger,
  ml: number,
  maxInSieve = Infinity
): number {
  if (!(ml > 0)) return 0
  ledger.rem.scooped += ml
  const room = Math.max(0, maxInSieve - ledger.inSieve)
  const whole = Math.min(Math.floor(ledger.rem.scooped), room)
  ledger.rem.scooped -= whole
  // A full sieve can't bank fractions it has no room for.
  if (whole === room) ledger.rem.scooped = Math.min(ledger.rem.scooped, 0.999)
  ledger.scooped += whole
  ledger.inSieve += whole
  return whole
}

/**
 * Moves a continuous loss into `channel`. Fractions wait in the channel's remainder;
 * whole mL move at once, clamped to the water in the sieve. Returns the whole mL moved.
 */
export function leak(
  ledger: SieveLedger,
  channel: OutChannel,
  ml: number
): number {
  if (!(ml > 0) || ledger.inSieve <= 0) return 0
  ledger.rem[channel] += ml
  const whole = Math.min(Math.floor(ledger.rem[channel]), ledger.inSieve)
  if (whole <= 0) return 0
  ledger.rem[channel] -= whole
  ledger.inSieve -= whole
  ledger[channel] += whole
  return whole
}

/** Moves exactly `ml` whole millilitres (clamped to the water left). Returns what moved. */
export function move(
  ledger: SieveLedger,
  channel: OutChannel,
  ml: number
): number {
  const whole = Math.min(Math.max(0, Math.floor(ml)), ledger.inSieve)
  ledger.inSieve -= whole
  ledger[channel] += whole
  return whole
}

/** Moves every mL left in the sieve into `channel`, for breaks, tips and deliveries. */
export function moveAll(ledger: SieveLedger, channel: OutChannel): number {
  const whole = ledger.inSieve
  ledger.inSieve = 0
  ledger[channel] += whole
  // Nothing is left to leak, so pending fractions are dropped.
  for (const key of OUT_CHANNELS) ledger.rem[key] = 0
  return whole
}

const OUT_CHANNELS: readonly OutChannel[] = [
  'delivered',
  'drained',
  'dripped',
  'splashed'
]

/** True when the sieve invariant holds exactly. */
export function isBalanced(ledger: SieveLedger): boolean {
  return (
    Number.isInteger(ledger.scooped) &&
    ledger.inSieve >= 0 &&
    ledger.scooped ===
      ledger.inSieve +
        ledger.delivered +
        ledger.drained +
        ledger.dripped +
        ledger.splashed
  )
}
