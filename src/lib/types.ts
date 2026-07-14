// The Rivers domain types. The on-disk shape is an append-only event log (see
// events.ts); these are the folded, in-memory records the UI reads.

import type { Actor } from './events'

/** A person who visits rivers. Each keeps their own list, in their own colour,
 *  all on the same map. Solo use is just the one-person case. */
export interface Person {
  id: string
  name: string
  /** #rrggbb — the accent this person's rivers glow in on the map. */
  color: string
  createdAt: string
}

/** One person having visited one river. Keyed by `${riverId}::${personId}`. */
export interface Visit {
  riverId: string
  personId: string
  /** the river's name, snapshotted at visit time (survives a data upgrade). */
  name: string
  /** fuzzy visit date: '', '2003', '2019-08', or '2019-08-14' (see dates.ts). */
  date: string
  note: string
  actor: Actor | null
  updatedAt: string
}

/** A river as it exists in the bundled geometry (see geo.ts). */
export interface River {
  id: string
  name: string
  /** 'river' | 'lake' — lake centerlines are drawn a touch differently. */
  cla: string
  /** Natural Earth scalerank; lower = more prominent (used for label priority). */
  rank: number
}

/** Where the log lives, relative to the app's own data folder. */
export const PATHS = {
  events: 'v0/events.jsonl',
} as const

/** A curated, high-contrast palette for new people (hex, map-safe). Sky-blue
 *  leads because it's the app's own accent — the natural colour for "you". */
export const PERSON_COLORS = [
  '#38bdf8', // sky
  '#f97316', // orange
  '#22c55e', // green
  '#e879f9', // fuchsia
  '#facc15', // amber
  '#f43f5e', // rose
  '#a78bfa', // violet
  '#2dd4bf', // teal
] as const
