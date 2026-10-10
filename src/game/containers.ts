import type { GameState } from './sim'

/** The three containers you fill, in order. */
export type ContainerId = 'bucket' | 'sink' | 'tub'

export interface ContainerDef {
  id: ContainerId
  name: string
  capacityMl: number
  /** Coins for filling it. */
  bonus: number
}

export const CONTAINERS: readonly ContainerDef[] = [
  { id: 'bucket', name: 'Bucket', capacityMl: 10_000, bonus: 50 },
  { id: 'sink', name: 'Sink', capacityMl: 20_000, bonus: 100 },
  { id: 'tub', name: 'Bathtub', capacityMl: 100_000, bonus: 0 }
]

/**
 * The container the house and the HUD show. While a pour's result shows, they stay on
 * the one this trip poured into, so the pour that fills the bucket ends on the full
 * bucket rather than jumping to the empty sink before its cutscene.
 */
export function shownContainer(state: GameState): number {
  const result = state.phase === 'poured' || state.phase === 'drained'
  return state.scene === 'house' && result
    ? state.current.container
    : state.containerIndex
}

/** One container's water. Invariant: delivered === inContainer + plugDrained + catDrunk. */
export interface ContainerLedger {
  delivered: number
  inContainer: number
  plugDrained: number
  catDrunk: number
  /** Rain sits outside the invariant and always drains back to 0. */
  rainMl: number
  /** Locked once full: nothing more goes in or out. */
  done: boolean
  /** Fractions of a mL owed to the cat and the drain, carried between steps. */
  rem: { cat: number; plug: number }
}

export function createContainers(): ContainerLedger[] {
  return CONTAINERS.map(() => ({
    delivered: 0,
    inContainer: 0,
    plugDrained: 0,
    catDrunk: 0,
    rainMl: 0,
    done: false,
    rem: { cat: 0, plug: 0 }
  }))
}

/** Room left in a container, in mL. */
export function roomMl(ledger: ContainerLedger, def: ContainerDef): number {
  return ledger.done ? 0 : Math.max(0, def.capacityMl - ledger.inContainer)
}

/** Adds whole mL that reached the container. */
export function receive(ledger: ContainerLedger, ml: number): void {
  ledger.delivered += ml
  ledger.inContainer += ml
}

/** True when the container's own invariant holds. */
export function containerBalanced(ledger: ContainerLedger): boolean {
  return (
    ledger.delivered ===
    ledger.inContainer + ledger.plugDrained + ledger.catDrunk
  )
}

/**
 * Moves `ml` out of a container to the cat or down the drain. Fractions carry over to the
 * next step and whole mL move, never more than the container holds. A full container is
 * locked and loses nothing. Returns the whole mL moved.
 */
export function drainContainer(
  ledger: ContainerLedger,
  channel: 'cat' | 'plug',
  ml: number
): number {
  if (ledger.done || !(ml > 0)) return 0
  ledger.rem[channel] += ml
  const whole = Math.min(Math.floor(ledger.rem[channel]), ledger.inContainer)
  ledger.rem[channel] -= whole
  // An empty container can't bank what it doesn't have.
  if (whole === ledger.inContainer)
    ledger.rem[channel] = Math.min(ledger.rem[channel], 0.999)
  ledger.inContainer -= whole
  if (channel === 'cat') ledger.catDrunk += whole
  else ledger.plugDrained += whole
  return whole
}
