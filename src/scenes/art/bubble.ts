import {
  palette,
  sketchPolygon,
  sketchRoundRect,
  sketchText,
  type SketchStyle,
  type SketchTextStyle
} from '../../shared'

const BUBBLE: SketchStyle = {
  fill: '#ffffff',
  color: palette.ink,
  width: 3,
  wobble: 1.5,
  seed: 401
}
const tailPoints = new Float64Array(6)
/** Its width follows the bubble's, so it's set per call. */
const SPEECH: SketchTextStyle = { size: 24, maxWidth: 0 }

/**
 * A speech bubble centred on (x, y), `width` wide, with its tail pointing at
 * (tailX, tailY). Callers and the cast talk through these on the canvas.
 */
export function drawSpeech(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  text: string,
  tailX: number,
  tailY: number
): void {
  const height = 64
  tailPoints[0] = x - 14
  tailPoints[1] = y + height / 2 - 4
  tailPoints[2] = tailX
  tailPoints[3] = tailY
  tailPoints[4] = x + 14
  tailPoints[5] = y + height / 2 - 4
  sketchPolygon(ctx, tailPoints, BUBBLE)
  sketchRoundRect(ctx, x - width / 2, y - height / 2, width, height, 18, BUBBLE)
  SPEECH.maxWidth = width - 24
  sketchText(ctx, text, x, y, SPEECH)
}
