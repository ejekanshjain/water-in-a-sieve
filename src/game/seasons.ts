import { SPRING_TUB_ML, WINTER_TUB_ML, YEAR_TWO_TRIP } from './tuning'
import type { Season } from './types'

/** Seasons in the order the year turns. */
export const SEASONS: readonly Season[] = [
  'summer',
  'autumn',
  'winter',
  'spring'
]

/**
 * The season for your progress: summer while you fill the bucket, autumn from the sink,
 * winter at 15 L in the bathtub and spring at 60 L.
 */
export function seasonFor(containerIndex: number, tubMl: number): Season {
  if (containerIndex <= 0) return 'summer'
  if (containerIndex === 1 || tubMl < WINTER_TUB_ML) return 'autumn'
  return tubMl < SPRING_TUB_ML ? 'winter' : 'spring'
}

/** Position of a season in the year, 0 for summer. */
export function seasonIndex(season: Season): number {
  return SEASONS.indexOf(season)
}

/** The later of two seasons, so losing tub water never turns the year back. */
export function laterSeason(a: Season, b: Season): Season {
  return seasonIndex(b) > seasonIndex(a) ? b : a
}

/** Title Case name for badges and captions. */
export function seasonName(season: Season): string {
  return season.charAt(0).toUpperCase() + season.slice(1)
}

/** True for the trip that starts the joke "Year 2". */
export function startsYearTwo(trip: number): boolean {
  return trip === YEAR_TWO_TRIP + 1
}
