// PeopleBar — pick whose list you're looking at (and checking off as), toggle the
// "Everyone" overlay, and add / edit / remove people. Each person keeps their own
// list in their own colour; solo use is just the one-person case.

import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { useStore } from '~/lib/store'
import { PERSON_COLORS, type Person } from '~/lib/types'
import { ColorDot } from '~/components/ui'

export function PeopleBar({
  everyoneMode,
  setEveryone,
  countFor,
}: {
  everyoneMode: boolean
  setEveryone: (on: boolean) => void
  countFor: (personId: string | null) => number
}) {
  const { people, activePersonId, setActivePerson, addPerson, updatePerson, removePerson } = useStore()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const pickPerson = (id: string) => {
    setEveryone(false)
    setActivePerson(id)
    setEditing(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {people.map((p) => {
        const active = !everyoneMode && p.id === activePersonId
        return (
          <div key={p.id} className="relative">
            <button
              type="button"
              onClick={() => pickPerson(p.id)}
              className={`group flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-2.5 text-sm transition-colors ${
                active ? 'border-transparent bg-accent-tint text-fg' : 'border-line2 text-fg2 hover:bg-panel-2'
              }`}
            >
              <ColorDot color={p.color} ring={active} />
              <span className="font-medium">{p.name}</span>
              <span className="tnum text-xs text-fg4">{countFor(p.id)}</span>
              {active && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Edit ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing((cur) => (cur === p.id ? null : p.id))
                  }}
                  className="-mr-1 ml-0.5 rounded p-0.5 text-fg4 hover:text-fg"
                >
                  <Pencil size={12} />
                </span>
              )}
            </button>
            {editing === p.id && (
              <PersonEditor
                person={p}
                canDelete={people.length > 1}
                onSave={(patch) => {
                  void updatePerson(p.id, patch)
                  setEditing(null)
                }}
                onDelete={() => {
                  void removePerson(p.id)
                  setEditing(null)
                }}
                onClose={() => setEditing(null)}
              />
            )}
          </div>
        )
      })}

      {people.length > 1 && (
        <button
          type="button"
          onClick={() => setEveryone(true)}
          className={`flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-2.5 text-sm transition-colors ${
            everyoneMode ? 'border-transparent bg-accent-tint text-fg' : 'border-line2 text-fg2 hover:bg-panel-2'
          }`}
        >
          <Users size={13} />
          <span className="font-medium">Everyone</span>
          <span className="tnum text-xs text-fg4">{countFor(null)}</span>
        </button>
      )}

      {adding ? (
        <AddPerson
          onAdd={(name, color) => {
            void addPerson(name, color).then((id) => pickPerson(id))
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-7 items-center gap-1 rounded-full border border-dashed border-line2 px-2.5 text-sm text-fg3 hover:bg-panel-2 hover:text-fg"
        >
          <Plus size={13} />
          Add
        </button>
      )}
    </div>
  )
}

function AddPerson({ onAdd, onCancel }: { onAdd: (name: string, color: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PERSON_COLORS[1])
  const submit = () => {
    const n = name.trim()
    if (n) onAdd(n, color)
  }
  return (
    <div className="glass panel-shadow absolute left-3 top-full z-20 mt-2 w-64 space-y-3 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg3">Add a person</span>
        <button type="button" onClick={onCancel} className="text-fg4 hover:text-fg">
          <X size={14} />
        </button>
      </div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Name"
        className="w-full rounded-md border border-line2 bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      />
      <Swatches value={color} onChange={setColor} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function PersonEditor({
  person,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  person: Person
  canDelete: boolean
  onSave: (patch: { name?: string; color?: string }) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(person.name)
  const [color, setColor] = useState(person.color)
  return (
    <div className="glass panel-shadow absolute left-0 top-full z-20 mt-2 w-64 space-y-3 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg3">Edit person</span>
        <button type="button" onClick={onClose} className="text-fg4 hover:text-fg">
          <X size={14} />
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border border-line2 bg-panel px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      />
      <Swatches value={color} onChange={setColor} />
      <div className="flex items-center justify-between">
        {canDelete ? (
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 text-sm text-bad hover:underline">
            <Trash2 size={13} />
            Remove
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => onSave({ name: name.trim() || person.name, color })}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90"
        >
          <Check size={13} />
          Save
        </button>
      </div>
    </div>
  )
}

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PERSON_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onChange(c)}
          className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
          style={{ background: c, outline: value === c ? '2px solid var(--color-fg)' : 'none', outlineOffset: 2 }}
        >
          {value === c && <Check size={12} className="text-white drop-shadow" />}
        </button>
      ))}
    </div>
  )
}
