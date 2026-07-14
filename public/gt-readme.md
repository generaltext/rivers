# Rivers

A life list for the world's waterways. Every named river on Earth sits on one
interactive map, greyed out until you've been there. Tap a river you've visited,
stamp the date (a year is fine), jot a note if you like, and it lights up. Do it once
and it's a memento; do it for a life and the map becomes a portrait of everywhere
your water has run.

- **A collection that fills in over time.** Like a birder's life list, but for moving
  water. A running count, a searchable list, and a map that warms up river by river.
- **More than one person.** Add the people you travel with; each keeps their own list
  in their own color, all on the same map. Show one person, or everyone at once.
- **Fuzzy dates welcome.** You don't have to remember the day. "2003" or "summer 2019"
  or a full date — whatever you've got.
- **Yours forever, no account.** Everything is a plain JSON-lines file in your own
  workspace. It syncs across your devices, works offline, and under the app sandbox
  literally cannot phone home. Hand the file to your AI and ask "how many rivers in
  2025?" without this app in the loop.

## What it writes

- `v0/events.jsonl` — an append-only log of every change (people you add, rivers you
  check off, dates and notes you edit). The source of truth; nothing is ever rewritten
  in place, so your log merges cleanly across devices.

## The river data

Rivers come from [Natural Earth](https://www.naturalearthdata.com/) (public domain) —
the world's named, human-meaningful rivers, bundled into the app so it stays fully
offline. Coverage is deliberately the "rivers you could name," not every creek; a small
local river may not be present yet.
