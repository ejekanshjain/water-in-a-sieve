import { describe, expect, it } from 'vitest'

import {
  column,
  columnWalkPad,
  layoutMode,
  WALK_PAD,
  walkPadRect,
  type LayoutState
} from './layout'

/** A 1024 x 768 tablet held sideways: the 540 x 960 design scales to 0.8. */
const TABLET: LayoutState = {
  mode: 'columns',
  left: 296,
  top: 0,
  width: 432,
  height: 768,
  scale: 0.8,
  viewWidth: 1024,
  viewHeight: 768,
  safeTop: 0,
  safeRight: 20,
  safeBottom: 10,
  safeLeft: 0
}

describe('walk pad', () => {
  it('uses the bottom band slot on phones', () => {
    expect(walkPadRect({ ...TABLET, mode: 'bands' })).toBe(WALK_PAD)
  })

  it('sits at the foot of the right column on a wide touch screen', () => {
    expect(layoutMode(TABLET.viewWidth, TABLET.width)).toBe('columns')
    const right = column(TABLET, 'right')
    const pad = columnWalkPad(TABLET)
    expect(pad.left).toBe(right.left)
    expect(pad.width).toBe(right.width)
    expect(pad.top + pad.height).toBe(right.top + right.height)
    expect(pad.height).toBeGreaterThanOrEqual(96)
  })

  it('hit-tests the same box the HUD draws, in logical units', () => {
    const pad = columnWalkPad(TABLET)
    const rect = walkPadRect(TABLET)
    // Right of the design, so a press there never grips.
    expect(rect.x).toBeGreaterThanOrEqual(540)
    expect(TABLET.left + rect.x * TABLET.scale).toBeCloseTo(pad.left)
    expect(TABLET.top + rect.y * TABLET.scale).toBeCloseTo(pad.top)
    expect(rect.width * TABLET.scale).toBeCloseTo(pad.width)
    expect(rect.height * TABLET.scale).toBeCloseTo(pad.height)
  })
})
