import type { TripRecord } from './sim'
import { ML_PER_COIN, NO_DRIP_BONUS, NO_DRIP_MIN_SCOOP } from './tuning'

/** Coins for a delivery: 10 per litre, rounded per delivery. */
export function coinsFor(deliveredMl: number): number {
  return Math.round(deliveredMl / ML_PER_COIN)
}

/** No-Drip badge state when a trip starts: only a near-full scoop can earn it. */
export function startingNoDrip(scoopedMl: number, capacityMl: number) {
  return scoopedMl >= NO_DRIP_MIN_SCOOP * capacityMl ? 'intact' : 'none'
}

/** The No-Drip bonus a finished trip earns. */
export function noDripBonus(trip: TripRecord): number {
  return trip.noDrip === 'intact' && trip.deliveredMl > 0 ? NO_DRIP_BONUS : 0
}
