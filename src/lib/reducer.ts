// The projection: fold the event log into current-state records (people + visits).
// Application is idempotent (each event id applied at most once), so re-folding is
// always safe. A full rebuild sorts events by (ts, id) first, making last-writer-
// wins deterministic regardless of the order lines happened to land in the file.

import { type Actor, type RiversEvent, visitKey } from './events'
import type { Person, Visit } from './types'

export interface State {
  people: Record<string, Person>
  /** person ids in creation order (for a stable people bar) */
  order: string[]
  visits: Record<string, Visit>
  applied: Set<string>
}

export function emptyState(): State {
  return { people: {}, order: [], visits: {}, applied: new Set() }
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Fold a batch of events into a fresh state, in deterministic (ts, id) order. */
export function foldEvents(events: RiversEvent[]): State {
  const state = emptyState()
  const sorted = [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1))
  for (const ev of sorted) applyEvent(state, ev)
  return state
}

export function applyEvent(state: State, ev: RiversEvent): void {
  if (state.applied.has(ev.id)) return
  state.applied.add(ev.id)

  const [entity, verb] = ev.type.split('.')
  const data = ev.data ?? {}

  if (entity === 'person') applyPerson(state, ev, verb ?? '', data)
  else if (entity === 'river') applyRiver(state, ev, verb ?? '', data)
  // Unknown entity from a newer build: ignored (forward-compatible by design).
}

function applyPerson(state: State, ev: RiversEvent, verb: string, data: Record<string, unknown>): void {
  const id = ev.subject
  if (verb === 'create') {
    if (state.people[id]) return
    state.people[id] = {
      id,
      name: asString(data.name) || 'You',
      color: asString(data.color) || '#38bdf8',
      createdAt: ev.ts,
    }
    state.order.push(id)
    return
  }
  const rec = state.people[id]
  if (!rec) return
  if (verb === 'update') {
    if (typeof data.name === 'string' && data.name.trim()) rec.name = data.name.trim()
    if (typeof data.color === 'string') rec.color = data.color
  } else if (verb === 'remove') {
    delete state.people[id]
    state.order = state.order.filter((x) => x !== id)
    // Drop that person's visits too, so the map/list don't show orphans.
    for (const [k, v] of Object.entries(state.visits)) if (v.personId === id) delete state.visits[k]
  }
}

function applyRiver(state: State, ev: RiversEvent, verb: string, data: Record<string, unknown>): void {
  const riverId = asString(data.riverId)
  const personId = asString(data.personId)
  if (!riverId || !personId) return
  const key = visitKey(riverId, personId)

  if (verb === 'visit') {
    // Upsert: create on first check, or overwrite date/note on a later edit.
    const prev = state.visits[key]
    state.visits[key] = {
      riverId,
      personId,
      name: asString(data.name) || prev?.name || '',
      date: 'date' in data ? asString(data.date) : (prev?.date ?? ''),
      note: 'note' in data ? asString(data.note) : (prev?.note ?? ''),
      actor: (ev.actor as Actor | null) ?? null,
      updatedAt: ev.ts,
    }
  } else if (verb === 'unvisit') {
    delete state.visits[key]
  }
}

// ── selectors ────────────────────────────────────────────────────────────────

export function peopleList(state: State): Person[] {
  return state.order.map((id) => state.people[id]).filter((p): p is Person => !!p)
}

/** Visits belonging to a person (or everyone, when personId is null). */
export function visitsFor(state: State, personId: string | null): Visit[] {
  return Object.values(state.visits).filter((v) => (personId ? v.personId === personId : true))
}

/** Person ids who have visited a given river. */
export function visitorsOf(state: State, riverId: string): string[] {
  const out: string[] = []
  for (const v of Object.values(state.visits)) if (v.riverId === riverId && state.people[v.personId]) out.push(v.personId)
  return out
}

/** The set of river ids visited by a person (or anyone, when personId is null). */
export function visitedRiverIds(state: State, personId: string | null): Set<string> {
  const out = new Set<string>()
  for (const v of Object.values(state.visits)) {
    if (!state.people[v.personId]) continue
    if (personId && v.personId !== personId) continue
    out.add(v.riverId)
  }
  return out
}

export function getVisit(state: State, riverId: string, personId: string): Visit | undefined {
  return state.visits[visitKey(riverId, personId)]
}
