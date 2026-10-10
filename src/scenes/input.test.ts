import { describe, expect, it } from 'vitest'

import {
  classifyRelease,
  GripControl,
  SPACE_GRIP,
  touchGrace,
  type ReleaseInfo
} from './input'

const CLEAN: ReleaseInfo = {
  eventType: 'pointerup',
  paused: false,
  pauseThisFrame: false,
  blocked: false,
  hasFocus: true
}

const mouse = (id: number) => ({ id, type: 'mouse', x: 270, y: 320 })
const touch = (id: number, x = 270, y = 320) => ({ id, type: 'touch', x, y })

describe('release classification', () => {
  it('treats a plain pointerup as letting go', () => {
    expect(classifyRelease(CLEAN)).toBe('letGo')
    expect(classifyRelease({ ...CLEAN, eventType: 'keyup' })).toBe('letGo')
  })

  it('treats blur, dialogs, cancels and pauses as a pause', () => {
    expect(classifyRelease({ ...CLEAN, eventType: 'pointercancel' })).toBe(
      'pause'
    )
    expect(classifyRelease({ ...CLEAN, hasFocus: false })).toBe('pause')
    expect(classifyRelease({ ...CLEAN, blocked: true })).toBe('pause')
    expect(classifyRelease({ ...CLEAN, paused: true })).toBe('pause')
    expect(classifyRelease({ ...CLEAN, pauseThisFrame: true })).toBe('pause')
  })
})

describe('grip control', () => {
  it('grips with the pressing pointer and releases only for that id', () => {
    const grip = new GripControl()
    expect(grip.down(mouse(1), false)).toBe('grip')
    expect(grip.takePressed()).toBe(true)
    expect(grip.takePressed()).toBe(false)
    grip.up(2, 'letGo')
    expect(grip.gripId).toBe(1)
    expect(grip.takeReleased()).toBe('none')
    grip.up(1, 'letGo')
    expect(grip.gripId).toBeNull()
    expect(grip.takeReleased()).toBe('letGo')
  })

  it('grips with Space when no pointer holds the sieve', () => {
    const grip = new GripControl()
    expect(grip.spaceDown()).toBe(true)
    expect(grip.gripId).toBe(SPACE_GRIP)
    expect(grip.down(mouse(1), false)).toBe('none')
    grip.spaceUp('pause')
    expect(grip.takeReleased()).toBe('pause')
  })

  it('walks with a pad thumb and grips with the other in two-thumb mode', () => {
    const grip = new GripControl()
    expect(grip.down(touch(5, 400, 900), true)).toBe('walk')
    expect(grip.walkIds.has(5)).toBe(true)
    expect(grip.down(touch(6), false)).toBe('grip')
    // Lifting the grip thumb lets go, even though the walk thumb stays down.
    grip.up(6, 'letGo')
    expect(grip.takeReleased()).toBe('letGo')
    expect(grip.gripId).toBeNull()
    expect(grip.walkIds.has(5)).toBe(true)
    grip.up(5, 'letGo')
    expect(grip.walkIds.size).toBe(0)
    expect(grip.takeReleased()).toBe('none')
  })

  it('never counts a mouse on the pad area as walking', () => {
    const grip = new GripControl()
    expect(grip.down(mouse(1), true)).toBe('grip')
  })

  it('ends the grip as a pause when a dialog opens, and ignores its later pointerup', () => {
    const grip = new GripControl()
    grip.down(touch(5, 400, 900), true)
    grip.down(mouse(1), false)
    grip.takePressed()
    grip.cancelAll()
    expect(grip.takeReleased()).toBe('pause')
    expect(grip.walkIds.size).toBe(0)
    grip.up(1, 'letGo')
    expect(grip.takeReleased()).toBe('none')
    // The next press grips afresh.
    expect(grip.down(mouse(1), false)).toBe('grip')
  })

  it('drops a grip from the other kind of device when the input set changes', () => {
    const grip = new GripControl()
    grip.down(mouse(1), false)
    grip.takePressed()
    grip.switchTo('mouse')
    expect(grip.gripId).toBe(1)
    grip.switchTo('touch')
    expect(grip.gripId).toBeNull()
    // The sim handles the switch, so no release is reported, now or on the mouse's pointerup.
    expect(grip.takeReleased()).toBe('none')
    grip.up(1, 'letGo')
    expect(grip.takeReleased()).toBe('none')
    expect(grip.down(touch(2), false)).toBe('grip')
    grip.switchTo('motion')
    expect(grip.gripId).toBeNull()
  })

  it('lets every touch walk in motion mode, and counts it as a press for resuming', () => {
    const grip = new GripControl()
    expect(grip.down(touch(3), false, true)).toBe('walk')
    expect(grip.gripId).toBeNull()
    expect(grip.takePressed()).toBe(true)
    expect(grip.walkIds.has(3)).toBe(true)
    // Lifting it never lets go of anything: the phone is the grip.
    grip.up(3, 'letGo')
    expect(grip.takeReleased()).toBe('none')
  })
})

describe('touch grace', () => {
  it('halves motion jolt for 150 ms after a touch press or release', () => {
    expect(touchGrace(0)).toBe(0.5)
    expect(touchGrace(149)).toBe(0.5)
    expect(touchGrace(150)).toBe(1)
  })
})
