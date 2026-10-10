import { describe, expect, it } from 'vitest'

import { laterSeason, seasonFor, startsYearTwo } from './seasons'
import { milestoneGag } from './story'

describe('seasons', () => {
  it('follows progress: summer bucket, autumn sink, winter at 15 L, spring at 60 L', () => {
    expect(seasonFor(0, 0)).toBe('summer')
    expect(seasonFor(1, 0)).toBe('autumn')
    expect(seasonFor(2, 14_999)).toBe('autumn')
    expect(seasonFor(2, 15_000)).toBe('winter')
    expect(seasonFor(2, 59_999)).toBe('winter')
    expect(seasonFor(2, 60_000)).toBe('spring')
  })

  it('never turns back when the tub loses water', () => {
    expect(laterSeason('winter', seasonFor(2, 14_000))).toBe('winter')
    expect(laterSeason('autumn', 'winter')).toBe('winter')
  })

  it('jokes "Year 2" on trip 151 only', () => {
    expect(startsYearTwo(150)).toBe(false)
    expect(startsYearTwo(151)).toBe(true)
    expect(startsYearTwo(152)).toBe(false)
  })
})

describe('bathtub milestones', () => {
  it('plays each gag once, and only the highest when a pour passes two', () => {
    expect(milestoneGag(0, 24_999)).toBeNull()
    expect(milestoneGag(0, 25_000)).toBe('duck')
    expect(milestoneGag(1, 30_000)).toBeNull()
    expect(milestoneGag(1, 50_000)).toBe('catTest')
    expect(milestoneGag(0, 51_000)).toBe('catTest')
    expect(milestoneGag(2, 75_500)).toBe('reschedule')
    expect(milestoneGag(3, 99_000)).toBeNull()
  })
})
