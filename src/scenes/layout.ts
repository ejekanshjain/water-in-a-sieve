import {
  BOTTOM_BAND_START,
  COLUMN_PAD_MAX_PX,
  COLUMN_PAD_MIN_PX,
  COLUMN_PAD_SHARE,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  MIN_COLUMN_PX,
  TOP_BAND_END
} from '../game/tuning'
import { createStore, type Viewport } from '../shared'

/** Where the HUD goes, in CSS px from the top-left of the page. */
export interface LayoutState {
  /** 'bands' puts the HUD inside the design's top and bottom bands; 'columns' beside it. */
  mode: 'bands' | 'columns'
  /** The design rect. */
  left: number
  top: number
  width: number
  height: number
  /** CSS px per logical unit. */
  scale: number
  viewWidth: number
  viewHeight: number
  /** Safe-area insets in CSS px. */
  safeTop: number
  safeRight: number
  safeBottom: number
  safeLeft: number
}

export const layout = createStore<LayoutState>({
  mode: 'bands',
  left: 0,
  top: 0,
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  scale: 1,
  viewWidth: DESIGN_WIDTH,
  viewHeight: DESIGN_HEIGHT,
  safeTop: 0,
  safeRight: 0,
  safeBottom: 0,
  safeLeft: 0
})

/** Picks bands or columns for a design rect inside a page of `viewWidth` CSS px. */
export function layoutMode(
  viewWidth: number,
  designWidth: number
): 'bands' | 'columns' {
  return (viewWidth - designWidth) / 2 >= MIN_COLUMN_PX ? 'columns' : 'bands'
}

/** A CSS box for a band, in px. */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** A rectangle in logical design units. */
export interface LogicalRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Fixed slots in the phone's bottom band, in logical units. The Hold to Walk pad is
 * display-only; the input layer hit-tests the same rect per pointer.
 */
export const METER_ROW: LogicalRect = {
  x: 0,
  y: BOTTOM_BAND_START,
  width: 540,
  height: 45
}
export const CHORES_SLOT: LogicalRect = { x: 0, y: 865, width: 135, height: 95 }
export const CONTEXT_SLOT: LogicalRect = {
  x: 135,
  y: 865,
  width: 135,
  height: 95
}
export const WALK_PAD: LogicalRect = { x: 270, y: 865, width: 270, height: 95 }

/** A logical rect as a CSS box, trimmed to the safe area. */
export function logicalBox(l: LayoutState, rect: LogicalRect): Box {
  const left = Math.max(l.left + rect.x * l.scale, l.safeLeft)
  const top = Math.max(l.top + rect.y * l.scale, l.safeTop)
  const right = Math.min(
    l.left + (rect.x + rect.width) * l.scale,
    l.viewWidth - l.safeRight
  )
  const bottom = Math.min(
    l.top + (rect.y + rect.height) * l.scale,
    l.viewHeight - l.safeBottom
  )
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}

/** The top band (logical y 0 to 120), kept clear of the safe area. */
export function topBand(l: LayoutState): Box {
  const top = Math.max(l.top, l.safeTop)
  const bottom = l.top + TOP_BAND_END * l.scale
  return { ...horizontal(l), top, height: Math.max(0, bottom - top) }
}

/** The left or right column beside the design, inside the safe area. */
export function column(l: LayoutState, side: 'left' | 'right'): Box {
  const top = Math.max(l.top, l.safeTop)
  const bottom = Math.min(l.top + l.height, l.viewHeight - l.safeBottom)
  const left = side === 'left' ? l.safeLeft : l.left + l.width
  const right = side === 'left' ? l.left : l.viewWidth - l.safeRight
  return { left, top, width: right - left, height: bottom - top }
}

/**
 * The Hold to Walk pad on a wide touch screen, such as a tablet held sideways: the
 * bottom of the right column, under the right thumb. The HUD draws it while the input is
 * touch; the input layer hit-tests the same box through `walkPadRect`.
 */
export function columnWalkPad(l: LayoutState): Box {
  const right = column(l, 'right')
  const height = Math.min(
    right.height,
    Math.max(
      COLUMN_PAD_MIN_PX,
      Math.min(COLUMN_PAD_MAX_PX, right.height * COLUMN_PAD_SHARE)
    )
  )
  return { ...right, top: right.top + right.height - height, height }
}

/** The walk pad the input layer hit-tests, in logical units, for either layout. */
export function walkPadRect(l: LayoutState): LogicalRect {
  if (l.mode === 'bands') return WALK_PAD
  const box = columnWalkPad(l)
  return {
    x: (box.left - l.left) / l.scale,
    y: (box.top - l.top) / l.scale,
    width: box.width / l.scale,
    height: box.height / l.scale
  }
}

function horizontal(l: LayoutState): { left: number; width: number } {
  const left = Math.max(l.left, l.safeLeft)
  const right = Math.min(l.left + l.width, l.viewWidth - l.safeRight)
  return { left, width: right - left }
}

/** Keeps the layout store in step with the viewport. Returns a stop function. */
export function trackLayout(viewport: Viewport): () => void {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
  document.body.appendChild(probe)
  const update = () => {
    const style = getComputedStyle(probe)
    const width = DESIGN_WIDTH * viewport.scale
    layout.set({
      mode: layoutMode(viewport.cssWidth, width),
      left: viewport.offsetX,
      top: viewport.offsetY,
      width,
      height: DESIGN_HEIGHT * viewport.scale,
      scale: viewport.scale,
      viewWidth: viewport.cssWidth,
      viewHeight: viewport.cssHeight,
      safeTop: parseFloat(style.paddingTop) || 0,
      safeRight: parseFloat(style.paddingRight) || 0,
      safeBottom: parseFloat(style.paddingBottom) || 0,
      safeLeft: parseFloat(style.paddingLeft) || 0
    })
  }
  update()
  const stop = viewport.onResize(update)
  return () => {
    stop()
    probe.remove()
  }
}
