// The event envelope. One JSON object per line in v0/events.jsonl; immutable once
// written. Every change to Rivers is an event of the form "<entity>.<verb>":
//
//   person.create | person.update | person.remove   (subject = personId)
//   river.visit   | river.unvisit                    (subject = `${riverId}::${personId}`)
//
// `river.visit` is an upsert — checking a river off, or later editing its date /
// note, is the same event re-appended with the new values (last-writer-wins in the
// fold). We never rewrite a line, which is what keeps concurrent appends from two
// devices merging cleanly.

export interface Actor {
  id: string
  name: string
}

export interface RiversEvent {
  /** evt_<ulid> — unique, sortable, used for dedupe/idempotency */
  id: string
  /** ISO timestamp from the writing client (LWW tiebreak + audit) */
  ts: string
  /** who wrote it, from gt.user() (or a local fallback); null if unknown */
  actor: Actor | null
  /** "<entity>.<verb>" */
  type: string
  /** the id of the record this event is about (personId, or a visit key) */
  subject: string
  /** verb-specific payload */
  data?: Record<string, unknown>
}

/** A change to append, before the envelope is stamped (id/ts/actor added by the store). */
export interface Draft {
  type: string
  subject: string
  data?: Record<string, unknown>
}

export function serializeEvent(ev: RiversEvent): string {
  return JSON.stringify(ev)
}

export function parseEvent(line: string): RiversEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed) as RiversEvent
    if (typeof obj.id === 'string' && typeof obj.type === 'string' && typeof obj.subject === 'string') {
      return obj
    }
  } catch {
    // A malformed line (a half-synced write, a hand-edit) is skipped, not fatal.
  }
  return null
}

/** The key a visit is stored under: one record per (river, person). */
export function visitKey(riverId: string, personId: string): string {
  return `${riverId}::${personId}`
}
