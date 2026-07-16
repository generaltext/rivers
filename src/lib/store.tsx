// The store: one live subscription to v0/events.jsonl, folded into people +
// visits, plus the dispatch that stamps and appends new events. Appends read the
// freshest file content and add to the end, so the runtime diffs each write to a
// pure end-insertion — concurrent appends from two devices both survive.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useGtText } from '~/hooks/use-gt-files'
import { type Actor, type Draft, type RiversEvent, parseEvent, serializeEvent, visitKey } from './events'
import { foldEvents, type State } from './reducer'
import { newId, ulid } from './ids'
import { PATHS, PERSON_COLORS, type Person } from './types'
import { buildDemoSeed } from './seed'

interface StoreValue {
  state: State
  me: Actor | null
  people: Person[]
  activePersonId: string | null
  setActivePerson: (id: string | null) => void
  addPerson: (name: string, color: string) => Promise<string>
  updatePerson: (id: string, patch: { name?: string; color?: string }) => Promise<void>
  removePerson: (id: string) => Promise<void>
  checkRiver: (riverId: string, name: string, fields: { date: string; note: string }, personId: string) => Promise<void>
  uncheckRiver: (riverId: string, personId: string) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)
const ACTIVE_KEY = 'rivers.activePerson'

function parseAll(text: string): RiversEvent[] {
  const out: RiversEvent[] = []
  for (const line of text.split('\n')) {
    const ev = parseEvent(line)
    if (ev) out.push(ev)
  }
  return out
}

async function resolveMe(): Promise<Actor> {
  try {
    const u = await window.gt.user()
    if (u) return { id: u.id, name: u.name }
  } catch {
    /* fall through to a local identity */
  }
  let id = localStorage.getItem('rivers.actor.id')
  if (!id) {
    id = `local_${ulid()}`
    localStorage.setItem('rivers.actor.id', id)
  }
  return { id, name: localStorage.getItem('rivers.actor.name') || 'You' }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const text = useGtText(PATHS.events)
  const state = useMemo(() => foldEvents(parseAll(text)), [text])

  const meRef = useRef<Actor | null>(null)
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve())
  const seeded = useRef(false)

  const [activePersonId, setActive] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY))

  const dispatch = useCallback(async (drafts: Draft | Draft[]): Promise<void> => {
    const list = Array.isArray(drafts) ? drafts : [drafts]
    if (list.length === 0) return
    const now = new Date().toISOString()
    const events: RiversEvent[] = list.map((d) => ({
      id: newId('evt'),
      ts: now,
      actor: meRef.current,
      type: d.type,
      subject: d.subject,
      ...(d.data ? { data: d.data } : {}),
    }))
    // Serialize writes; always base the append on the freshest content so the
    // runtime's diff is a pure end-insertion (never a delete of a remote line).
    const run = writeQueue.current.then(async () => {
      const base = window.gt.subscribeFile(PATHS.events).toString()
      const prefix = base.length === 0 || base.endsWith('\n') ? base : base + '\n'
      const body = events.map(serializeEvent).join('\n')
      await window.gt.writeFile(PATHS.events, prefix + body + '\n')
    })
    writeQueue.current = run.catch(() => undefined)
    await run
  }, [])

  const setActivePerson = useCallback((id: string | null) => {
    setActive(id)
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [])

  const addPerson = useCallback<StoreValue['addPerson']>(
    async (name, color) => {
      const id = newId('per')
      await dispatch({ type: 'person.create', subject: id, data: { name, color } })
      return id
    },
    [dispatch],
  )
  const updatePerson = useCallback<StoreValue['updatePerson']>(
    async (id, patch) => void (await dispatch({ type: 'person.update', subject: id, data: patch })),
    [dispatch],
  )
  const removePerson = useCallback<StoreValue['removePerson']>(
    async (id) => void (await dispatch({ type: 'person.remove', subject: id })),
    [dispatch],
  )
  const checkRiver = useCallback<StoreValue['checkRiver']>(
    async (riverId, name, fields, personId) =>
      void (await dispatch({
        type: 'river.visit',
        subject: visitKey(riverId, personId),
        data: { riverId, personId, name, date: fields.date, note: fields.note },
      })),
    [dispatch],
  )
  const uncheckRiver = useCallback<StoreValue['uncheckRiver']>(
    async (riverId, personId) =>
      void (await dispatch({ type: 'river.unvisit', subject: visitKey(riverId, personId), data: { riverId, personId } })),
    [dispatch],
  )

  // Resolve identity once, then make sure at least one person exists so the app is
  // usable on first open. Seeding is guarded so it happens exactly once.
  useEffect(() => {
    let done = false
    void (async () => {
      await window.gt.ready
      const me = await resolveMe()
      if (done) return
      meRef.current = me
      // `ready` only means the workspace connected; the events file's content
      // arrives after. Wait for it to sync before deciding to seed, or we'd read
      // an empty file, see no person, and create a fresh duplicate on every open.
      await window.gt.whenFileSynced(PATHS.events)
      if (done) return
      if (!seeded.current) {
        const events = parseAll(window.gt.subscribeFile(PATHS.events).toString())
        const hasPerson = events.some((e) => e.type === 'person.create')
        if (!hasPerson) {
          seeded.current = true
          // In a demo context (gallery "try it live" or the standalone demo) seed
          // sample people + visited rivers so the map opens alive. In a real
          // workspace just create the one default person. Never seed real data.
          const isDemo = window.gt.mode === 'demo' || window.__riversDemo === true
          if (isDemo) {
            const { drafts, activeId } = buildDemoSeed(me)
            await dispatch(drafts)
            setActivePerson(activeId)
          } else {
            const id = await addPerson(me.name, PERSON_COLORS[0])
            setActivePerson(id)
          }
        }
      }
    })()
    return () => {
      done = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const people = useMemo(() => state.order.map((id) => state.people[id]).filter((p): p is Person => !!p), [state])

  // Keep the active person valid: default to the first, drop if removed.
  useEffect(() => {
    if (people.length === 0) return
    if (!activePersonId || !people.some((p) => p.id === activePersonId)) {
      setActivePerson(people[0]!.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, activePersonId])

  const value = useMemo<StoreValue>(
    () => ({
      state,
      me: meRef.current,
      people,
      activePersonId,
      setActivePerson,
      addPerson,
      updatePerson,
      removePerson,
      checkRiver,
      uncheckRiver,
    }),
    [state, people, activePersonId, setActivePerson, addPerson, updatePerson, removePerson, checkRiver, uncheckRiver],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
