// Poster rendering — the same map, composed as a print-style artwork on a canvas.
// Used for both the on-screen preview and the high-res PNG export, so what you see
// is exactly what downloads. Pure drawing: give it a context, a size, and options.

import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { LAND, RIVER_FEATURES, featureById } from './geo'

export interface PosterTheme {
  name: string
  bg: string
  fg: string
  land: string
  base: string // faint "all rivers" colour
}

export const POSTER_THEMES: PosterTheme[] = [
  { name: 'Midnight', bg: '#0b1220', fg: '#eaf1f7', land: '#161f2b', base: '#26313f' },
  { name: 'Paper', bg: '#f4eede', fg: '#2a2118', land: '#e7dfcc', base: '#ccbf9f' },
  { name: 'Sea', bg: '#d9e5ed', fg: '#16202a', land: '#ffffff', base: '#a9bccb' },
  { name: 'Noir', bg: '#0a0a0b', fg: '#f2f2f2', land: '#161618', base: '#2b2b2f' },
]

export interface PosterOptions {
  title: string
  subtitle: string
  theme: PosterTheme
  showLand: boolean
  showBase: boolean
  /** riverId → colour for visited rivers */
  visited: Map<string, string>
  /** multiply base line widths (user "thickness" control) */
  thickness: number
}

export function drawPoster(ctx: CanvasRenderingContext2D, w: number, h: number, o: PosterOptions): void {
  const t = o.theme
  ctx.save()
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, w, h)

  const padX = w * 0.055
  const padTop = h * 0.055
  const padBottom = h * 0.16 // room for the title block
  const projection = geoNaturalEarth1().fitExtent(
    [
      [padX, padTop],
      [w - padX, h - padBottom],
    ],
    { type: 'Sphere' },
  )
  const path = geoPath(projection, ctx)
  const unit = Math.max(w, h) / 1100 // scales line weights with poster size

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (o.showLand) {
    ctx.beginPath()
    path(LAND as never)
    ctx.fillStyle = t.land
    ctx.fill()
  }

  if (o.showBase) {
    ctx.beginPath()
    for (const f of RIVER_FEATURES) path(f as never)
    ctx.strokeStyle = t.base
    ctx.lineWidth = 0.5 * unit * o.thickness
    ctx.stroke()
  }

  // visited rivers, grouped by colour so we stroke once per colour
  const byColor = new Map<string, string[]>()
  for (const [id, color] of o.visited) {
    const arr = byColor.get(color) ?? []
    arr.push(id)
    byColor.set(color, arr)
  }
  for (const [color, ids] of byColor) {
    ctx.beginPath()
    for (const id of ids) {
      const f = featureById(id)
      if (f) path(f as never)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 1.6 * unit * o.thickness
    ctx.shadowColor = color
    ctx.shadowBlur = 4 * unit
    ctx.stroke()
  }
  ctx.shadowBlur = 0

  // title block, bottom-left
  const bx = padX
  const by = h - padBottom + h * 0.02
  ctx.fillStyle = t.fg
  ctx.textBaseline = 'top'
  const titleSize = Math.round(h * 0.055)
  ctx.font = `600 ${titleSize}px "Iowan Old Style", Palatino, Georgia, serif`
  ctx.fillText(o.title || 'Rivers', bx, by)
  if (o.subtitle) {
    const subSize = Math.round(h * 0.026)
    ctx.font = `400 ${subSize}px system-ui, sans-serif`
    ctx.globalAlpha = 0.75
    ctx.fillText(o.subtitle, bx, by + titleSize * 1.15)
    ctx.globalAlpha = 1
  }

  // count + attribution, bottom-right
  const rightSize = Math.round(h * 0.022)
  ctx.font = `500 ${rightSize}px system-ui, sans-serif`
  ctx.textAlign = 'right'
  ctx.globalAlpha = 0.6
  ctx.fillText(`${o.visited.size} ${o.visited.size === 1 ? 'river' : 'rivers'} · Natural Earth`, w - padX, h - padBottom + h * 0.05)
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
  ctx.restore()
}
