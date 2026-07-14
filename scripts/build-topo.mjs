// build-topo.mjs — turn the GeoJSON produced by build-data.mjs into the compact
// TopoJSON assets the app actually ships. TopoJSON delta-encodes coordinates as
// integers on a quantized grid, which roughly halves rivers.json with no visible
// change; the app decodes it straight back to GeoJSON at load (see src/lib/geo.ts).
//
//   src/data/rivers.json  →  rivers-full.topo.json   (lossless-ish: Q=4e5 ≈ 100m,
//                                                      every river + vertex kept)
//                         →  rivers-lite.topo.json   (Q=1e5 + Visvalingam simplify,
//                                                      ~1/5 the size, drops a handful
//                                                      of sub-grid river stubs)
//   src/data/land.json    →  land.topo.json          (Q=4e4 ≈ matches 2-decimal land)
//
// Run: `pnpm topo` (after `pnpm data`, or any time the GeoJSON changes).

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { topology } from 'topojson-server'
import { presimplify, simplify } from 'topojson-simplify'
import { feature } from 'topojson-client'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(here, '..', 'src', 'data')

const RIVERS_Q_FULL = 4e5 // ~100m at the equator — matches the 3-decimal source
const RIVERS_Q_LITE = 1e5 // ~400m — invisible on a world map
const LITE_WEIGHT = 3e-4 // Visvalingam min area; larger = more aggressive
const LAND_Q = 4e4 // ~1km — matches the 2-decimal land backdrop

const read = (name) => JSON.parse(readFileSync(resolve(DATA, name), 'utf8'))
const mb = (obj) => (Buffer.byteLength(JSON.stringify(obj)) / 1e6).toFixed(2) + 'MB'
const write = (name, obj) => {
  writeFileSync(resolve(DATA, name), JSON.stringify(obj))
  return obj
}

// Drop line parts with <2 points (simplification can collapse tiny stubs) and any
// feature left with no geometry, so re-encoding to TopoJSON doesn't choke.
function cleanRivers(fc) {
  const features = []
  let droppedRivers = 0
  for (const f of fc.features) {
    const parts = (f.geometry?.coordinates ?? []).filter((line) => line.length >= 2)
    if (parts.length === 0) {
      droppedRivers++
      continue
    }
    features.push({ ...f, geometry: { type: 'MultiLineString', coordinates: parts } })
  }
  return { fc: { type: 'FeatureCollection', features }, droppedRivers }
}

const rivers = read('rivers.json')
const land = read('land.json')
console.log(`source: rivers.json ${mb(rivers)} (${rivers.features.length} rivers), land.json ${mb(land)}`)

// ── rivers: full (lossless-ish) ───────────────────────────────────────────────
const full = write('rivers-full.topo.json', topology({ rivers }, RIVERS_Q_FULL))
console.log(`rivers-full.topo.json: ${mb(full)}  (Q=${RIVERS_Q_FULL}, all ${rivers.features.length} rivers)`)

// ── rivers: lite (quantize + simplify) ────────────────────────────────────────
// Simplify at a fine grid so vertex weights are meaningful, then re-quantize at the
// lite grid, which also strips the presimplify z-weights from the emitted arcs.
const simplified = simplify(presimplify(topology({ rivers }, 1e6)), LITE_WEIGHT)
const { fc: liteFc, droppedRivers } = cleanRivers(feature(simplified, simplified.objects.rivers))
const lite = write('rivers-lite.topo.json', topology({ rivers: liteFc }, RIVERS_Q_LITE))
console.log(
  `rivers-lite.topo.json: ${mb(lite)}  (Q=${RIVERS_Q_LITE} + simplify ${LITE_WEIGHT}, ` +
    `${liteFc.features.length} rivers, ${droppedRivers} sub-grid stubs dropped)`,
)

// ── land backdrop ─────────────────────────────────────────────────────────────
const landTopo = write('land.topo.json', topology({ land }, LAND_Q))
console.log(`land.topo.json: ${mb(landTopo)}  (Q=${LAND_Q}, ${land.features.length} polys)`)
