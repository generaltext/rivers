// Demo seed — sample people + visited rivers so the "Try the demo" session (and
// the gallery live demo) opens with a map that's already alive, not blank. Only
// ever runs when the log is empty AND we're in a demo context (see store boot), so
// it can never touch a real workspace. Rivers are resolved by name from the bundled
// data, so ids stay correct across data rebuilds.

import type { Actor, Draft } from './events'
import { visitKey } from './events'
import { newId } from './ids'
import { RIVERS } from './geo'
import { PERSON_COLORS } from './types'

// name → River (lowest-rank/most-prominent match; RIVERS is sorted by rank asc).
const BY_NAME = new Map<string, string>()
for (const r of RIVERS) {
  const k = r.name.toLowerCase()
  if (!BY_NAME.has(k)) BY_NAME.set(k, r.id)
}

interface SeedVisit {
  river: string
  date: string
  note?: string
}

const PERSON_ONE: SeedVisit[] = [
  { river: 'Amazonas', date: '2016', note: 'source-to-sea, still the dream' },
  { river: 'Mississippi', date: '2011-07' },
  { river: 'Colorado', date: '2019-08', note: 'rafted the Grand Canyon' },
  { river: 'Columbia', date: '2014' },
  { river: 'Hudson', date: '2009' },
  { river: 'Rhine', date: '2007-05' },
  { river: 'Danube', date: '2018' },
  { river: 'Nile', date: '2013-02', note: 'felucca out of Aswan' },
  { river: 'Ganges', date: '2015-11' },
  { river: 'Mekong', date: '2017', note: 'slow boat to Luang Prabang' },
  { river: 'Yangtze', date: '2017' },
  { river: 'Zambezi', date: '2012', note: 'Victoria Falls' },
  { river: 'Yukon', date: '2023-06', note: 'midnight-sun paddle' },
]

const PERSON_TWO: SeedVisit[] = [
  { river: 'Seine', date: '2019' },
  { river: 'Loire', date: '2019-09', note: 'château country by bike' },
  { river: 'Thames', date: '2005' },
  { river: 'Rhine', date: '2007-05' }, // overlaps person one
  { river: 'Danube', date: '2018' }, // overlaps person one
  { river: 'Volga', date: '2016' },
  { river: 'Mekong', date: '2017' }, // overlaps person one
  { river: 'Paraná', date: '2021' },
]

function visitsFor(personId: string, visits: SeedVisit[]): Draft[] {
  const out: Draft[] = []
  for (const v of visits) {
    const riverId = BY_NAME.get(v.river.toLowerCase())
    if (!riverId) continue
    out.push({
      type: 'river.visit',
      subject: visitKey(riverId, personId),
      data: { riverId, personId, name: v.river, date: v.date, note: v.note ?? '' },
    })
  }
  return out
}

/** Build the seed: two people and their visited rivers. `activeId` is who the demo
 *  opens focused on. The primary person takes the demo user's name if we have one. */
export function buildDemoSeed(me: Actor | null): { drafts: Draft[]; activeId: string } {
  const p1 = newId('per')
  const p2 = newId('per')
  const name1 = me?.name && me.name !== 'You' ? me.name : 'Sam'
  const drafts: Draft[] = [
    { type: 'person.create', subject: p1, data: { name: name1, color: PERSON_COLORS[0] } },
    { type: 'person.create', subject: p2, data: { name: 'Robin', color: PERSON_COLORS[1] } },
    ...visitsFor(p1, PERSON_ONE),
    ...visitsFor(p2, PERSON_TWO),
  ]
  return { drafts, activeId: p1 }
}
