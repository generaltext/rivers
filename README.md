# Rivers

A life list for the world's waterways — a General Text app. Every named river on
Earth sits on one interactive map, greyed out until you've been there; tap a river,
stamp a (fuzzy) date and an optional note, and it lights up. Add the people you
travel with and each keeps their own list in their own colour on the same map.

- Product: https://www.generaltext.org
- App guide: https://www.generaltext.org/llms.txt (local: `projects/generaltext/content/docs/building-apps.md`)
- Plan: `planning/apps/rivers/init.md` in the meta repo.

## How it works

**Storage — an append-only event log.** The single source of truth is
`v0/events.jsonl` in your workspace: one immutable JSON event per line
(`person.create/update/remove`, `river.visit`, `river.unvisit`). The UI is a
projection folded from it (`src/lib/reducer.ts`). Appends read the freshest file
content and add to the end, so the runtime diffs each write to a pure end-insertion
and concurrent appends from two devices both survive. Nothing is ever rewritten in
place; editing a visit is a re-appended `river.visit` (last-writer-wins in the fold),
unchecking is a `river.unvisit`. Visits are keyed by `${riverId}::${personId}`, so
multi-person is native and solo is just the one-person case.

**River data — bundled, offline.** Rivers come from
[Natural Earth](https://www.naturalearthdata.com/) (public domain), baked into the
build (`src/data/rivers.json`, ~3,000 named rivers) so the app is fully offline and
CSP-safe — no tiles, no network. `scripts/build-data.mjs` merges the global 10m set
with the North America and Europe regional files, then (because Natural Earth ships no
stable per-river id and splits a river across features and files) rebuilds rivers
itself: group every named segment by name, then split each name into
spatially-connected clusters (union-find over bbox proximity). One cluster = one
checkable river, so a river's reaches merge and cross-file duplicates collapse, while
distinct same-named rivers (the two Colorados) stay separate. A deterministic
`riverId` is baked in. Regenerate with `pnpm data` (raw inputs in `scripts/raw/`,
gitignored — see the script header for URLs).

**Rendering — canvas, not SVG.** The map is drawn on a `<canvas>` with `d3-geo`
(Natural Earth projection): each river is a prebuilt `Path2D`, grey rivers stroked as
a few combined paths per width tier, visited ones stroked individually over the top;
zoom is a context transform with `lineWidth/k` so strokes stay crisp and geometry is
projected once. Hover/click hit-testing reads a hidden **colour-coded pick canvas**
(each river a unique colour) at the cursor pixel, so you always select the line you're
actually on. The poster view reuses the same projection (`src/lib/poster.ts`).

## Develop

```
pnpm install
pnpm dev         # vite injects window.gt from generaltext.org; runs standalone
pnpm test        # vitest — reducer + fuzzy-date logic
pnpm typecheck
pnpm build
pnpm data        # regenerate src/data/{rivers,land}.json from Natural Earth
```

`pnpm dev` serves a local in-browser workspace (IndexedDB + cross-tab sync). Opened
directly on the deployed site with no runtime, the app shows an install splash with a
"Try the demo" button that boots the same local runtime.

## Not yet built (v-next)

- **Lazy-load `rivers.json`** from `public/` (fetch at runtime) instead of bundling
  it into the JS — the denser data pushes the JS bundle to ~9MB (2.6MB gzip); moving
  the ~8MB of geometry out cuts parse cost and first paint. Same-origin fetch is
  CSP-safe.
- **Add a river by hand** for coverage gaps (Natural Earth still thins out for small
  rivers outside NA/Europe) — ideally by clicking a point over an OSM `waterway` layer.
- **Repeat visits** — one record per (river, person) today; a `visits[]` array is a
  clean extension.
- **Disambiguate same-named rivers** in the list (e.g. the 6 Colorados) with a region
  hint.
- **IndexedDB projection cache** — deferred; the log is small enough to full-fold on
  each change.
- **Denser basemap** — optionally graduate to HydroRIVERS vector tiles on R2 for
  every-creek detail behind the checkable named set.
