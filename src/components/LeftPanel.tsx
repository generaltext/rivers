// LeftPanel — the single home for all chrome: title + running count, the people
// bar, the selected river's check-off form (inline), and the browsable list of
// visited rivers (with search across all rivers). Everything that used to be three
// separate floating panels now lives here.

import { useCallback } from 'react'
import { Image, Moon, PanelLeftClose, Sun, Waves } from 'lucide-react'
import { useStore } from '~/lib/store'
import { visitedRiverIds } from '~/lib/reducer'
import { PeopleBar } from '~/components/PeopleBar'
import { RiverDetail } from '~/components/RiverDetail'
import { ListPanel } from '~/components/ListPanel'
import { IconButton } from '~/components/ui'

export function LeftPanel({
  everyoneMode,
  setEveryone,
  selectedId,
  onSelect,
  onDeselect,
  theme,
  onOpenPoster,
  onCollapse,
}: {
  everyoneMode: boolean
  setEveryone: (on: boolean) => void
  selectedId: string | null
  onSelect: (riverId: string) => void
  onDeselect: () => void
  theme: { dark: boolean; canToggle: boolean; toggle: () => void }
  onOpenPoster: () => void
  onCollapse: () => void
}) {
  const { state, people, activePersonId } = useStore()
  const countFor = useCallback((pid: string | null) => visitedRiverIds(state, pid).size, [state])
  const activePerson = people.find((p) => p.id === activePersonId)
  const count = countFor(everyoneMode ? null : activePersonId)

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="shrink-0 p-3.5 pb-2.5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-accent">
              <Waves size={19} />
            </span>
            <h1 className="font-serif text-lg font-semibold leading-none">Rivers</h1>
          </div>
          <div className="flex items-center gap-0.5">
            <IconButton label="Poster view" onClick={onOpenPoster}>
              <Image size={15} />
            </IconButton>
            {theme.canToggle && (
              <IconButton label="Toggle theme" onClick={theme.toggle}>
                {theme.dark ? <Sun size={15} /> : <Moon size={15} />}
              </IconButton>
            )}
            <IconButton label="Hide panel" onClick={onCollapse}>
              <PanelLeftClose size={15} />
            </IconButton>
          </div>
        </div>

        <div className="mb-2.5 mt-2 flex items-baseline gap-1.5">
          <span data-testid="count" className="tnum font-serif text-3xl font-semibold text-fg">{count}</span>
          <span className="text-sm text-fg3">
            {count === 1 ? 'river' : 'rivers'} · {everyoneMode ? 'everyone' : (activePerson?.name ?? 'you')}
          </span>
        </div>

        <PeopleBar everyoneMode={everyoneMode} setEveryone={setEveryone} countFor={countFor} />
      </div>

      {/* body: inline detail (when a river is selected) above the list */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--color-glass-line)]">
        {selectedId && <RiverDetail riverId={selectedId} onClose={onDeselect} />}
        <ListPanel everyoneMode={everyoneMode} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </div>
  )
}
