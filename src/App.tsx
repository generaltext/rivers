// App — the shell. A full-bleed map with ONE glassy panel on the left holding all
// chrome (title, count, people, the selected river's form, and the list). A poster
// view opens over everything on demand.

import { useCallback, useMemo, useState } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { useStore } from '~/lib/store'
import { useTheme } from '~/hooks/use-theme'
import { RiverMap, type FocusTarget } from '~/components/RiverMap'
import { LeftPanel } from '~/components/LeftPanel'
import { PosterView } from '~/components/PosterView'

export function App() {
  const store = useStore()
  const theme = useTheme()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hover, setHover] = useState<{ id: string; name: string } | null>(null)
  const [everyoneMode, setEveryone] = useState(false)
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [poster, setPoster] = useState(false)

  // riverId → lit colour for the map.
  const colors = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of Object.values(store.state.visits)) {
      const p = store.state.people[v.personId]
      if (!p) continue
      if (everyoneMode) {
        if (!m.has(v.riverId)) m.set(v.riverId, p.color)
      } else if (v.personId === store.activePersonId) {
        m.set(v.riverId, p.color)
      }
    }
    return m
  }, [store.state, everyoneMode, store.activePersonId])

  const selectFromList = useCallback((id: string) => {
    setSelectedId(id)
    setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))
  }, [])

  return (
    <div className="relative h-full w-full">
      <RiverMap
        colors={colors}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onHover={setHover}
        focus={focus}
        themeKey={theme.dark}
      />

      {/* hovered river name, floating over the map */}
      {hover && hover.id !== selectedId && (
        <div data-testid="hover-pill" className="glass panel-shadow pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-medium text-fg">
          {hover.name}
        </div>
      )}

      {/* the one panel */}
      {panelOpen ? (
        <div className="glass panel-shadow absolute z-20 flex flex-col overflow-hidden inset-x-2 bottom-2 max-h-[62vh] rounded-2xl sm:inset-x-auto sm:left-4 sm:top-4 sm:bottom-4 sm:max-h-none sm:w-[21rem] sm:rounded-xl">
          <LeftPanel
            everyoneMode={everyoneMode}
            setEveryone={setEveryone}
            selectedId={selectedId}
            onSelect={selectFromList}
            onDeselect={() => setSelectedId(null)}
            theme={theme}
            onOpenPoster={() => setPoster(true)}
            onCollapse={() => setPanelOpen(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="glass panel-shadow absolute left-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg2 hover:text-fg"
          aria-label="Show panel"
        >
          <PanelLeftOpen size={17} />
        </button>
      )}

      {poster && <PosterView everyoneMode={everyoneMode} onClose={() => setPoster(false)} />}
    </div>
  )
}
