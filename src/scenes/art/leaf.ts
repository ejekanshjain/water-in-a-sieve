import {
  CachedLayer,
  palette,
  sketchLine,
  sketchPath,
  type LayerRect,
  type Viewport
} from '../../shared'

/** A leaf's stamp rect, centred on (0, 0) with the tip pointing right. */
const LEAF_RECT: LayerRect = { x: -40, y: -20, width: 72, height: 40 }
const COLOURS = [palette.orange, palette.yellow, '#c0562f'] as const
const outline = new Float64Array([
  -26, 0, -14, -12, 4, -14, 22, -5, 28, 0, 22, 5, 4, 14, -14, 12
])

function paintLeaf(ctx: CanvasRenderingContext2D, index: number): void {
  const colour = COLOURS[index] ?? palette.orange
  sketchLine(ctx, -26, 0, -36, 3, { width: 3, seed: 900 + index })
  sketchPath(ctx, outline, {
    closed: true,
    smooth: true,
    fill: colour,
    color: palette.ink,
    width: 2.5,
    wobble: 1.2,
    seed: 910 + index
  })
  const vein = { color: 'rgba(80, 40, 10, 0.55)', width: 1.5, wobble: 0.8 }
  sketchLine(ctx, -24, 0, 22, 0, { ...vein, seed: 920 + index })
  for (let i = 0; i < 3; i++) {
    const x = -14 + i * 12
    sketchLine(ctx, x, 0, x + 8, -8 + i, { ...vein, seed: 930 + i })
    sketchLine(ctx, x, 0, x + 8, 8 - i, { ...vein, seed: 940 + i })
  }
}

/** Autumn leaves in three colours, cached once and drawn at any spot, angle and size. */
export class LeafArt {
  readonly layers: CachedLayer[]

  constructor(viewport: Viewport) {
    this.layers = COLOURS.map(
      (_, i) => new CachedLayer(viewport, ctx => paintLeaf(ctx, i), LEAF_RECT)
    )
  }

  /** Draws a leaf at (x, y). `seed` picks its colour; `scale` 1 is the floating size. */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    scale: number,
    seed: number
  ): void {
    const layer = this.layers[seed % this.layers.length]
    if (!layer) return
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.scale(scale, scale)
    layer.draw(ctx)
    ctx.restore()
  }

  dispose(): void {
    for (const layer of this.layers) layer.dispose()
  }
}
