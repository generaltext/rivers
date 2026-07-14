// RiverMap — the hero, drawn on a <canvas> (not SVG). Every river is prebuilt as a
// Path2D once per projection; each frame strokes ~4 combined grey paths + a handful
// of lit ones, so pan/zoom stays smooth no matter how many rivers there are. A
// hidden "pick" canvas paints each river in a unique colour; hover/click read the
// pixel under the cursor (with a small neighbourhood search), so hit-testing is
// pixel-exact — you hover the line you're actually on, not a fat invisible box.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { Minus, Plus, Locate } from 'lucide-react'
import { LAND, RIVER_FEATURES, riverCentroid } from '~/lib/geo'

export interface FocusTarget {
  id: string
  n: number
}

interface RiverPath {
  id: string
  name: string
  rank: number
  path: Path2D
}

// width tiers (screen px at k=1) keyed by scalerank prominence
const TIERS = [
  { max: 2, w: 1.5 },
  { max: 4, w: 1.1 },
  { max: 6, w: 0.85 },
  { max: 99, w: 0.6 },
]
function tierIndex(rank: number): number {
  return TIERS.findIndex((t) => rank <= t.max)
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

export function RiverMap({
  colors,
  selectedId,
  onSelect,
  onHover,
  focus,
  themeKey,
}: {
  colors: Map<string, string>
  selectedId: string | null
  onSelect: (riverId: string | null) => void
  onHover: (river: { id: string; name: string } | null) => void
  focus: FocusTarget | null
  /** changes when the shell theme flips, so we recolour the canvas */
  themeKey: unknown
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pickRef = useRef<HTMLCanvasElement>(null) // offscreen, never displayed
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)

  const sizeRef = useRef({ w: 960, h: 640, dpr: 1 })
  const transformRef = useRef<ZoomTransform>(zoomIdentity)
  const colorsRef = useRef(colors)
  const hoverRef = useRef<string | null>(null)
  const selectedRef = useRef<string | null>(selectedId)
  const pickDirty = useRef(true)
  const rafId = useRef<number | null>(null)

  colorsRef.current = colors
  selectedRef.current = selectedId

  // Prebuilt geometry, recomputed only when the viewport size changes.
  const geo = useRef<{
    rivers: RiverPath[]
    byId: Map<string, RiverPath>
    tiers: Path2D[]
    land: Path2D
    sphere: Path2D
    project: (p: [number, number]) => [number, number] | null
  } | null>(null)

  const rebuildGeo = useCallback(() => {
    const { w, h } = sizeRef.current
    const projection = geoNaturalEarth1().fitSize([w, h], { type: 'Sphere' })
    const gp = geoPath(projection)
    const rivers: RiverPath[] = []
    const byId = new Map<string, RiverPath>()
    const tiers = TIERS.map(() => new Path2D())
    for (const f of RIVER_FEATURES) {
      const d = gp(f as never)
      if (!d) continue
      const path = new Path2D(d)
      const rec: RiverPath = { id: f.properties.id, name: f.properties.name, rank: f.properties.rank, path }
      rivers.push(rec)
      byId.set(rec.id, rec)
      const ti = tierIndex(f.properties.rank)
      tiers[ti]!.addPath(path)
    }
    const land = new Path2D(gp(LAND as never) ?? '')
    const sphere = new Path2D(gp({ type: 'Sphere' } as never) ?? '')
    geo.current = { rivers, byId, tiers, land, sphere, project: (p) => projection(p) }
    pickDirty.current = true
  }, [])

  const scheduleRender = useCallback(() => {
    if (rafId.current != null) return
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null
      render()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const g = geo.current
    if (!canvas || !g) return
    const ctx = canvas.getContext('2d')!
    const { w, h, dpr } = sizeRef.current
    const t = transformRef.current
    const k = t.k

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w * dpr, h * dpr)
    ctx.setTransform(k * dpr, 0, 0, k * dpr, t.x * dpr, t.y * dpr)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    const sea = cssVar('--color-sea')
    const land = cssVar('--color-land')
    const landLine = cssVar('--color-land-line')
    const river = cssVar('--color-river')

    // sea sphere + land backdrop
    ctx.fillStyle = sea
    ctx.fill(g.sphere)
    ctx.fillStyle = land
    ctx.fill(g.land)
    ctx.strokeStyle = landLine
    ctx.lineWidth = 0.4 / k
    ctx.stroke(g.land)

    // grey rivers, one stroke per width tier
    ctx.strokeStyle = river
    for (let i = 0; i < g.tiers.length; i++) {
      ctx.lineWidth = TIERS[i]!.w / k
      ctx.stroke(g.tiers[i]!)
    }

    // lit rivers (visited), each in its colour, drawn over the grey
    for (const [id, color] of colorsRef.current) {
      const rec = g.byId.get(id)
      if (!rec) continue
      ctx.strokeStyle = color
      ctx.lineWidth = (TIERS[tierIndex(rec.rank)]!.w + 0.7) / k
      ctx.stroke(rec.path)
    }

    // highlight hovered / selected on top
    const hid = hoverRef.current ?? selectedRef.current
    if (hid) {
      const rec = g.byId.get(hid)
      if (rec) {
        const lit = colorsRef.current.get(hid)
        ctx.strokeStyle = lit ?? cssVar('--color-river-hi')
        ctx.lineWidth = (TIERS[tierIndex(rec.rank)]!.w + (hid === selectedRef.current ? 1.8 : 1)) / k
        ctx.stroke(rec.path)
      }
    }
  }, [])

  // Repaint the pick buffer to match the current transform (lazy: only before a read).
  const repaintPick = useCallback(() => {
    const pick = pickRef.current
    const g = geo.current
    if (!pick || !g) return
    const ctx = pick.getContext('2d', { willReadFrequently: true })!
    const { w, h } = sizeRef.current
    const t = transformRef.current
    const k = t.k
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.setTransform(k, 0, 0, k, t.x, t.y)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 4.5 / k // a few px of tolerance, in screen space (kinder to touch)
    for (let i = 0; i < g.rivers.length; i++) {
      const idx = i + 1 // 0 = background
      ctx.strokeStyle = `rgb(${idx & 255},${(idx >> 8) & 255},0)`
      ctx.stroke(g.rivers[i]!.path)
    }
    pickDirty.current = false
  }, [])

  // Read the river under a CSS-space point (with a small neighbourhood search).
  const pickAt = useCallback(
    (cx: number, cy: number): RiverPath | null => {
      const pick = pickRef.current
      const g = geo.current
      if (!pick || !g) return null
      if (pickDirty.current) repaintPick()
      const ctx = pick.getContext('2d', { willReadFrequently: true })!
      const R = 7
      const x0 = Math.max(0, Math.floor(cx) - R)
      const y0 = Math.max(0, Math.floor(cy) - R)
      const side = R * 2 + 1
      let data: ImageData
      try {
        data = ctx.getImageData(x0, y0, side, side)
      } catch {
        return null
      }
      let best = -1
      let bestDist = Infinity
      for (let j = 0; j < side; j++) {
        for (let i = 0; i < side; i++) {
          const o = (j * side + i) * 4
          const r = data.data[o]!
          const gg = data.data[o + 1]!
          if (r === 0 && gg === 0) continue
          const px = x0 + i
          const py = y0 + j
          const dist = (px - cx) ** 2 + (py - cy) ** 2
          if (dist < bestDist) {
            bestDist = dist
            best = r + (gg << 8) - 1
          }
        }
      }
      if (best < 0 || best >= g.rivers.length) return null
      return g.rivers[best] ?? null
    },
    [repaintPick],
  )

  // resize
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      if (!e) return
      const w = Math.max(320, Math.round(e.contentRect.width))
      const h = Math.max(240, Math.round(e.contentRect.height))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      sizeRef.current = { w, h, dpr }
      const canvas = canvasRef.current
      const pick = pickRef.current
      if (canvas) {
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      if (pick) {
        pick.width = w
        pick.height = h
      }
      rebuildGeo()
      scheduleRender()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [rebuildGeo, scheduleRender])

  // zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const z = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 60])
      .on('zoom', (ev: { transform: ZoomTransform }) => {
        transformRef.current = ev.transform
        pickDirty.current = true
        scheduleRender()
      })
    select(canvas).call(z).on('dblclick.zoom', null)
    zoomRef.current = z
    return () => {
      select(canvas).on('.zoom', null)
    }
  }, [scheduleRender])

  // recolour + repaint when visits or theme change
  useEffect(() => {
    scheduleRender()
  }, [colors, selectedId, themeKey, scheduleRender])

  // fly to a river
  useEffect(() => {
    if (!focus) return
    const canvas = canvasRef.current
    const g = geo.current
    if (!canvas || !g || !zoomRef.current) return
    const c = riverCentroid(focus.id)
    if (!c) return
    const p = g.project(c)
    if (!p) return
    const { w, h } = sizeRef.current
    const k = 7
    const tf = zoomIdentity.translate(w / 2 - k * p[0], h / 2 - k * p[1]).scale(k)
    select(canvas).transition().duration(800).call(zoomRef.current.transform, tf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n])

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const hit = pickAt(e.clientX - rect.left, e.clientY - rect.top)
      const id = hit?.id ?? null
      if (id !== hoverRef.current) {
        hoverRef.current = id
        canvas.style.cursor = id ? 'pointer' : 'grab'
        onHover(hit ? { id: hit.id, name: hit.name } : null)
        scheduleRender()
      }
    },
    [onHover, pickAt, scheduleRender],
  )

  const onMouseLeave = useCallback(() => {
    if (hoverRef.current !== null) {
      hoverRef.current = null
      onHover(null)
      scheduleRender()
    }
  }, [onHover, scheduleRender])

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const hit = pickAt(e.clientX - rect.left, e.clientY - rect.top)
      onSelect(hit?.id ?? null)
    },
    [onSelect, pickAt],
  )

  const zoomBy = useCallback((factor: number) => {
    const canvas = canvasRef.current
    if (!canvas || !zoomRef.current) return
    select(canvas).transition().duration(250).call(zoomRef.current.scaleBy, factor)
  }, [])
  const reset = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !zoomRef.current) return
    select(canvas).transition().duration(600).call(zoomRef.current.transform, zoomIdentity)
  }, [])

  const memoStyle = useMemo(() => ({ background: 'var(--color-sea)' }), [])

  return (
    <div ref={wrapRef} className="absolute inset-0 h-full w-full overflow-hidden" style={memoStyle}>
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        style={{ display: 'block', cursor: 'grab' }}
      />
      <canvas ref={pickRef} style={{ display: 'none' }} />

      <div className="glass panel-shadow absolute right-4 top-4 flex flex-col overflow-hidden rounded-lg sm:bottom-4 sm:top-auto">
        <ZoomBtn label="Zoom in" onClick={() => zoomBy(1.6)}>
          <Plus size={16} />
        </ZoomBtn>
        <div className="h-px bg-[var(--color-glass-line)]" />
        <ZoomBtn label="Zoom out" onClick={() => zoomBy(1 / 1.6)}>
          <Minus size={16} />
        </ZoomBtn>
        <div className="h-px bg-[var(--color-glass-line)]" />
        <ZoomBtn label="Reset view" onClick={reset}>
          <Locate size={15} />
        </ZoomBtn>
      </div>
    </div>
  )
}

function ZoomBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="p-2 text-fg2 hover:bg-accent-tint hover:text-accent">
      {children}
    </button>
  )
}
