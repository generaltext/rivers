import { describe, expect, it } from 'vitest'
import { foldEvents, getVisit, visitedRiverIds, visitorsOf } from './reducer'
import type { RiversEvent } from './events'
import { visitKey } from './events'

let seq = 0
function ev(type: string, subject: string, data?: Record<string, unknown>, ts?: string): RiversEvent {
  seq += 1
  return { id: `evt_${String(seq).padStart(4, '0')}`, ts: ts ?? `2026-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`, actor: null, type, subject, ...(data ? { data } : {}) }
}

describe('foldEvents', () => {
  it('creates people in order and tracks visits per (river, person)', () => {
    const s = foldEvents([
      ev('person.create', 'per_a', { name: 'Ann', color: '#111111' }),
      ev('person.create', 'per_b', { name: 'Bo', color: '#222222' }),
      ev('river.visit', visitKey('r1', 'per_a'), { riverId: 'r1', personId: 'per_a', name: 'Nile', date: '2019' }),
      ev('river.visit', visitKey('r1', 'per_b'), { riverId: 'r1', personId: 'per_b', name: 'Nile', date: '2020-05' }),
    ])
    expect(s.order).toEqual(['per_a', 'per_b'])
    expect(getVisit(s, 'r1', 'per_a')?.date).toBe('2019')
    expect(visitorsOf(s, 'r1').sort()).toEqual(['per_a', 'per_b'])
    expect(visitedRiverIds(s, 'per_a').size).toBe(1)
    expect(visitedRiverIds(s, null).size).toBe(1) // one distinct river across everyone
  })

  it('treats a re-visit as an upsert (last write wins on date/note)', () => {
    const s = foldEvents([
      ev('person.create', 'per_a', { name: 'Ann', color: '#111111' }),
      ev('river.visit', visitKey('r1', 'per_a'), { riverId: 'r1', personId: 'per_a', name: 'Po', date: '2001' }),
      ev('river.visit', visitKey('r1', 'per_a'), { riverId: 'r1', personId: 'per_a', name: 'Po', date: '2010-08', note: 'again' }),
    ])
    const v = getVisit(s, 'r1', 'per_a')
    expect(v?.date).toBe('2010-08')
    expect(v?.note).toBe('again')
  })

  it('unvisit removes just that person-river', () => {
    const s = foldEvents([
      ev('person.create', 'per_a', { name: 'Ann', color: '#111111' }),
      ev('river.visit', visitKey('r1', 'per_a'), { riverId: 'r1', personId: 'per_a', name: 'Po' }),
      ev('river.unvisit', visitKey('r1', 'per_a'), { riverId: 'r1', personId: 'per_a' }),
    ])
    expect(getVisit(s, 'r1', 'per_a')).toBeUndefined()
    expect(visitedRiverIds(s, 'per_a').size).toBe(0)
  })

  it('removing a person drops their visits (no orphans)', () => {
    const s = foldEvents([
      ev('person.create', 'per_a', { name: 'Ann', color: '#111111' }),
      ev('river.visit', visitKey('r1', 'per_a'), { riverId: 'r1', personId: 'per_a', name: 'Po' }),
      ev('person.remove', 'per_a'),
    ])
    expect(s.people['per_a']).toBeUndefined()
    expect(visitorsOf(s, 'r1')).toEqual([])
    expect(Object.keys(s.visits).length).toBe(0)
  })

  it('folds deterministically regardless of line order (sorted by ts,id)', () => {
    const a = ev('person.create', 'per_a', { name: 'Ann', color: '#111111' }, '2026-01-01T00:00:01.000Z')
    const b = ev('river.visit', visitKey('r1', 'per_a'), { riverId: 'r1', personId: 'per_a', name: 'Po', date: '2001' }, '2026-01-01T00:00:02.000Z')
    const c = ev('river.visit', visitKey('r1', 'per_a'), { riverId: 'r1', personId: 'per_a', name: 'Po', date: '2020' }, '2026-01-01T00:00:03.000Z')
    const forward = foldEvents([a, b, c])
    const shuffled = foldEvents([c, a, b])
    expect(getVisit(forward, 'r1', 'per_a')?.date).toBe('2020')
    expect(getVisit(shuffled, 'r1', 'per_a')?.date).toBe('2020')
  })
})
