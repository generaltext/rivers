// PosterView — a customizable, exportable poster of the rivers you've visited.
// Same map, composed as wall art: pick a palette, whose data to include, per-person
// or single colour, a title, and download a high-res PNG. Preview and export share
// one renderer (lib/poster.ts) so the download matches the preview exactly.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useStore } from '~/lib/store'
import { drawPoster, POSTER_THEMES, type PosterTheme } from '~/lib/poster'
import { PERSON_COLORS } from '~/lib/types'
import { ColorDot } from '~/components/ui'

const EXPORT_W = 2400
const EXPORT_H = 1500
const SINGLE_COLORS = [...PERSON_COLORS, '#ffffff', '#111318']

export function PosterView({ everyoneMode, onClose }: { everyoneMode: boolean; onClose: () => void }) {
  const { state, people, activePersonId } = useStore()
  const previewRef = useRef<HTMLCanvasElement>(null)
  const previewWrap = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState('Rivers')
  const [subtitle, setSubtitle] = useState('')
  const [theme, setTheme] = useState<PosterTheme>(POSTER_THEMES[0]!)
  const [showLand, setShowLand] = useState(true)
  const [showBase, setShowBase] = useState(true)
  const [thickness, setThickness] = useState(1)
  const [singleColor, setSingleColor] = useState<string | null>(null)
  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(everyoneMode ? people.map((p) => p.id) : activePersonId ? [activePersonId] : people.map((p) => p.id)),
  )

  const visited = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of Object.values(state.visits)) {
      const p = state.people[v.personId]
      if (!p || !included.has(v.personId)) continue
      if (!m.has(v.riverId)) m.set(v.riverId, singleColor ?? p.color)
    }
    return m
  }, [state, included, singleColor])

  const opts = useMemo(
    () => ({ title, subtitle, theme, showLand, showBase, visited, thickness }),
    [title, subtitle, theme, showLand, showBase, visited, thickness],
  )

  // live preview
  useEffect(() => {
    const canvas = previewRef.current
    const wrap = previewWrap.current
    if (!canvas || !wrap) return
    const render = () => {
      const maxW = wrap.clientWidth - 32
      const maxH = wrap.clientHeight - 32
      if (maxW <= 0 || maxH <= 0) return
      const scale = Math.min(maxW / EXPORT_W, maxH / EXPORT_H)
      const cssW = Math.round(EXPORT_W * scale)
      const cssH = Math.round(EXPORT_H * scale)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawPoster(ctx, cssW, cssH, opts)
    }
    render()
    const ro = new ResizeObserver(render)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [opts])

  const download = () => {
    const off = document.createElement('canvas')
    off.width = EXPORT_W
    off.height = EXPORT_H
    const ctx = off.getContext('2d')!
    drawPoster(ctx, EXPORT_W, EXPORT_H, opts)
    off.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(title || 'rivers').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  const togglePerson = (id: string) =>
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(6,12,18,0.6)] backdrop-blur-sm sm:flex-row">
      {/* preview */}
      <div ref={previewWrap} className="flex h-[40vh] min-h-0 min-w-0 items-center justify-center p-3 sm:h-auto sm:flex-1 sm:p-4">
        <canvas ref={previewRef} className="rounded-lg shadow-2xl" />
      </div>

      {/* controls */}
      <div className="flex w-full min-h-0 flex-1 flex-col overflow-y-auto border-t border-line bg-panel sm:w-80 sm:flex-none sm:border-l sm:border-t-0">
        <div className="flex items-center justify-between border-b border-line p-3">
          <h2 className="font-serif text-lg font-semibold">Poster</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-fg3 hover:bg-panel-2 hover:text-fg" aria-label="Close poster">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-3">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-line2 bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
          </Field>
          <Field label="Subtitle">
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. a life in water · 2026" className="w-full rounded-md border border-line2 bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
          </Field>

          <Field label="Palette">
            <div className="grid grid-cols-2 gap-1.5">
              {POSTER_THEMES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${theme.name === t.name ? 'border-accent text-fg' : 'border-line2 text-fg2 hover:bg-panel-2'}`}
                >
                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: t.bg }} />
                  {t.name}
                </button>
              ))}
            </div>
          </Field>

          {people.length > 0 && (
            <Field label="Whose rivers">
              <div className="space-y-1">
                {people.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-panel-2">
                    <input type="checkbox" checked={included.has(p.id)} onChange={() => togglePerson(p.id)} className="accent-[var(--color-accent)]" />
                    <ColorDot color={p.color} size={9} />
                    <span className="text-fg2">{p.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          <Field label="River colour">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSingleColor(null)}
                className={`rounded-md border px-2 py-1 text-xs ${singleColor === null ? 'border-accent text-fg' : 'border-line2 text-fg3 hover:bg-panel-2'}`}
              >
                Per person
              </button>
              {SINGLE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setSingleColor(c)}
                  className="h-6 w-6 rounded-full border border-black/10"
                  style={{ background: c, outline: singleColor === c ? '2px solid var(--color-fg)' : 'none', outlineOffset: 2 }}
                />
              ))}
            </div>
          </Field>

          <Field label={`Line thickness`}>
            <input type="range" min={0.5} max={2.5} step={0.1} value={thickness} onChange={(e) => setThickness(Number(e.target.value))} className="w-full accent-[var(--color-accent)]" />
          </Field>

          <div className="space-y-1.5">
            <Toggle label="Show land" checked={showLand} onChange={setShowLand} />
            <Toggle label="Show all rivers (faint)" checked={showBase} onChange={setShowBase} />
          </div>
        </div>

        <div className="mt-auto border-t border-line p-3">
          <button
            type="button"
            onClick={download}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
          >
            <Download size={16} />
            Download PNG
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-fg3">{label}</span>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-fg2 hover:bg-panel-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
      {label}
    </label>
  )
}
