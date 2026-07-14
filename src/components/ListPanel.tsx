// ListPanel — the collection. The active person's (or everyone's) visited rivers,
// searchable and sortable, each row flying the map to that river. The search box
// also spans ALL rivers, so you can find one by name to check off even when you
// don't know where it is on the map.

import { useMemo, useState } from 'react'
import { ArrowDownAZ, CalendarClock, Search, Waves } from 'lucide-react'
import { useStore } from '~/lib/store'
import { RIVERS } from '~/lib/geo'
import { formatDate, sortKey } from '~/lib/dates'
import { ColorDot } from '~/components/ui'

interface Row {
  riverId: string
  name: string
  visitors: { personId: string; color: string; date: string }[]
  minKey: string
}

export function ListPanel({
  everyoneMode,
  selectedId,
  onSelect,
}: {
  everyoneMode: boolean
  selectedId: string | null
  onSelect: (riverId: string) => void
}) {
  const { state, activePersonId } = useStore()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'date' | 'name'>('date')

  const rows = useMemo<Row[]>(() => {
    const byRiver = new Map<string, Row>()
    for (const v of Object.values(state.visits)) {
      const p = state.people[v.personId]
      if (!p) continue
      if (!everyoneMode && v.personId !== activePersonId) continue
      let row = byRiver.get(v.riverId)
      if (!row) {
        row = { riverId: v.riverId, name: v.name, visitors: [], minKey: '~' }
        byRiver.set(v.riverId, row)
      }
      row.visitors.push({ personId: v.personId, color: p.color, date: v.date })
      const k = sortKey(v.date)
      if (k < row.minKey) row.minKey = k
    }
    const list = [...byRiver.values()]
    list.sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : a.minKey < b.minKey ? 1 : a.minKey > b.minKey ? -1 : a.name.localeCompare(b.name),
    )
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, everyoneMode, activePersonId, sort])

  const visitedIds = useMemo(() => new Set(rows.map((r) => r.riverId)), [rows])

  const q = query.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!q) return []
    return RIVERS.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 60)
  }, [q])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-glass-line)] p-2.5">
        <div className="flex items-center gap-2 rounded-md border border-line2 bg-panel px-2.5 py-1.5">
          <Search size={14} className="text-fg4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all rivers…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-fg4"
          />
        </div>
      </div>

      {q ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {searchResults.length === 0 ? (
            <Empty>No river matches "{query}".</Empty>
          ) : (
            searchResults.map((r) => (
              <RowButton
                key={r.id}
                name={r.name}
                selected={selectedId === r.id}
                onClick={() => onSelect(r.id)}
                right={
                  visitedIds.has(r.id) ? (
                    <span className="text-xs font-medium text-good">visited</span>
                  ) : (
                    <span className="text-xs text-fg4">{r.cla === 'lake' ? 'lake' : 'river'}</span>
                  )
                }
              />
            ))
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-3 py-2 text-xs text-fg3">
            <span className="tnum font-medium">
              {rows.length} {rows.length === 1 ? 'river' : 'rivers'}
            </span>
            <div className="flex items-center gap-0.5">
              <SortBtn active={sort === 'date'} onClick={() => setSort('date')} label="By date">
                <CalendarClock size={13} />
              </SortBtn>
              <SortBtn active={sort === 'name'} onClick={() => setSort('name')} label="By name">
                <ArrowDownAZ size={13} />
              </SortBtn>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {rows.length === 0 ? (
              <Empty>
                <Waves size={22} className="mx-auto mb-2 text-fg4" />
                No rivers yet. Tap one on the map to check it off.
              </Empty>
            ) : (
              rows.map((row) => (
                <RowButton
                  key={row.riverId}
                  name={row.name}
                  selected={selectedId === row.riverId}
                  onClick={() => onSelect(row.riverId)}
                  left={
                    <span className="flex -space-x-1">
                      {row.visitors.slice(0, 4).map((v) => (
                        <ColorDot key={v.personId} color={v.color} size={9} />
                      ))}
                    </span>
                  }
                  right={
                    <span className="tnum shrink-0 text-xs text-fg4">
                      {row.visitors.length > 1 && everyoneMode
                        ? `${row.visitors.length} people`
                        : formatDate(row.visitors[0]?.date)}
                    </span>
                  }
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RowButton({
  name,
  onClick,
  selected,
  left,
  right,
}: {
  name: string
  onClick: () => void
  selected: boolean
  left?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
        selected ? 'bg-accent-tint' : 'hover:bg-panel-2'
      }`}
    >
      {left}
      <span className="min-w-0 flex-1 truncate text-fg">{name}</span>
      {right}
    </button>
  )
}

function SortBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`rounded p-1 transition-colors ${active ? 'bg-accent-tint text-accent' : 'text-fg4 hover:text-fg'}`}
    >
      {children}
    </button>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-fg3">{children}</div>
}
