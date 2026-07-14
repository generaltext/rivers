// RiverDetail — the check-off / edit form for the selected river, shown INLINE at
// the top of the left panel (not a floating popover). The active person marks the
// river visited with a fuzzy date and an optional note, or edits / removes an
// existing visit. Also shows who else has been there.

import { useEffect, useMemo, useState } from 'react'
import { Check, MapPin, Trash2, X } from 'lucide-react'
import { useStore } from '~/lib/store'
import { getVisit, visitorsOf } from '~/lib/reducer'
import { riverById } from '~/lib/geo'
import { formatDate, isValidDate, normalizeDate } from '~/lib/dates'
import { ColorDot } from '~/components/ui'

export function RiverDetail({ riverId, onClose }: { riverId: string; onClose: () => void }) {
  const { state, people, activePersonId, checkRiver, uncheckRiver } = useStore()
  const river = riverById(riverId)
  const active = people.find((p) => p.id === activePersonId) ?? people[0]
  const existing = active ? getVisit(state, riverId, active.id) : undefined

  const [date, setDate] = useState(existing?.date ?? '')
  const [note, setNote] = useState(existing?.note ?? '')

  useEffect(() => {
    setDate(existing?.date ?? '')
    setNote(existing?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riverId, existing?.updatedAt])

  const visitors = useMemo(() => visitorsOf(state, riverId), [state, riverId])
  const dateOk = date.trim() === '' || isValidDate(date)

  if (!river || !active) return null

  const save = () => {
    if (!dateOk) return
    void checkRiver(riverId, river.name, { date: normalizeDate(date), note: note.trim() }, active.id)
  }
  const remove = () => {
    void uncheckRiver(riverId, active.id)
    onClose()
  }

  return (
    <div className="shrink-0 border-b border-[var(--color-glass-line)] bg-accent-soft/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-fg">
          <MapPin size={15} className="shrink-0 text-accent" />
          <h2 className="truncate font-serif text-base font-semibold leading-tight">{river.name}</h2>
        </div>
        <button type="button" onClick={onClose} className="-mr-1 rounded p-1 text-fg4 hover:bg-panel-2 hover:text-fg" aria-label="Close">
          <X size={15} />
        </button>
      </div>

      {visitors.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-xs text-fg4">Visited by</span>
          {visitors.map((pid) => {
            const p = state.people[pid]
            if (!p) return null
            return (
              <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-panel-2 py-0.5 pl-1.5 pr-2 text-xs text-fg2">
                <ColorDot color={p.color} size={7} />
                {p.name}
              </span>
            )
          })}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-fg3">
        {existing ? 'Editing' : 'Mark visited'} ·
        <span className="inline-flex items-center gap-1 font-medium text-fg">
          <ColorDot color={active.color} size={8} />
          {active.name}
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Year, or full date"
          className={`w-32 rounded-md border bg-panel px-2 py-1.5 text-sm outline-none ${dateOk ? 'border-line2 focus:border-accent' : 'border-bad'}`}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Note (optional)"
          className="min-w-0 flex-1 rounded-md border border-line2 bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-fg4">
          {date.trim() === '' ? 'A date is optional.' : dateOk ? formatDate(normalizeDate(date)) : 'Try a year or a full date.'}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        {existing ? (
          <button type="button" onClick={remove} className="inline-flex items-center gap-1 text-sm text-bad hover:underline">
            <Trash2 size={13} />
            Remove
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dateOk}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-40"
        >
          <Check size={14} />
          {existing ? 'Save' : 'Mark visited'}
        </button>
      </div>
    </div>
  )
}
