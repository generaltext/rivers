// build-data.mjs — turn raw Natural Earth downloads into the two bundled assets
// the app imports: src/data/rivers.json (one feature per *logical* river) and
// src/data/land.json (a muted land backdrop). Run: `pnpm data`.
//
// Inputs (in scripts/raw/, or /tmp) from nvkelso/natural-earth-vector:
//   ne_10m_rivers_lake_centerlines.geojson    (global named rivers)
//   ne_10m_rivers_north_america.geojson        (dense NA tributaries)
//   ne_10m_rivers_europe.geojson               (dense EU tributaries)
//   ne_50m_land.geojson                         → land.json
//
// Natural Earth has no stable per-river id and splits a river across features
// (and across files: the Mississippi appears in both the global and NA sets, and
// under two rivernums). So we IGNORE the source ids and rebuild rivers ourselves:
// group every named segment by name, then split each name into spatially-connected
// CLUSTERS (bboxes overlapping/near). One cluster = one checkable river. This
// merges a river's reaches and de-dups it across files, while keeping distinct
// same-named rivers (e.g. the two Colorados) separate. A deterministic riverId is
// derived from name + cluster centroid and baked in (stable across rebuilds).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const RAW = resolve(here, 'raw')
const OUT = resolve(here, '..', 'src', 'data')

const RIVER_DECIMALS = 3 // ~110m at the equator — plenty for a world map
const LAND_DECIMALS = 2
const MERGE_GAP = 1.5 // degrees: same-name segments within this gap join one river

const RIVER_FILES = ['rivers10.json', 'ne_10m_rivers_north_america.json', 'ne_10m_rivers_europe.json']

const round = (n, d) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
const roundRing = (ring, d) => ring.map(([x, y]) => [round(x, d), round(y, d)])

function fnv1a(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function load(name) {
  const p = existsSync(resolve(RAW, name)) ? resolve(RAW, name) : resolve('/tmp', name)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8'))
}

const norm = (s) => s.trim().replace(/\s+/g, ' ')
const key = (s) => norm(s).toLowerCase()

function linesOf(geom) {
  if (!geom) return []
  if (geom.type === 'MultiLineString') return geom.coordinates
  if (geom.type === 'LineString') return [geom.coordinates]
  return []
}

function bboxOf(lines) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (const line of lines)
    for (const [x, y] of line) {
      if (x < minx) minx = x
      if (y < miny) miny = y
      if (x > maxx) maxx = x
      if (y > maxy) maxy = y
    }
  return [minx, miny, maxx, maxy]
}

// Two bboxes are "near" if inflating one by MERGE_GAP makes them overlap.
function bboxNear(a, b, gap) {
  return a[0] - gap <= b[2] && b[0] - gap <= a[2] && a[1] - gap <= b[3] && b[1] - gap <= a[3]
}

// ── rivers ──────────────────────────────────────────────────────────────────
function buildRivers() {
  /** nameKey → { display, segs: [{lines, bbox, isRiver, rank}] } */
  const byName = new Map()

  for (const file of RIVER_FILES) {
    const fc = load(file)
    if (!fc) {
      console.warn(`  (skipped missing ${file})`)
      continue
    }
    for (const f of fc.features) {
      const p = f.properties || {}
      const display = norm(p.name_en || p.name || p.name_full || '')
      if (!display) continue
      const lines = linesOf(f.geometry)
      if (!lines.length) continue
      const k = key(display)
      let group = byName.get(k)
      if (!group) {
        group = { display, segs: [] }
        byName.set(k, group)
      }
      const rounded = lines.map((l) => roundRing(l, RIVER_DECIMALS))
      group.segs.push({
        lines: rounded,
        bbox: bboxOf(rounded),
        isRiver: p.featurecla !== 'Lake Centerline',
        rank: p.scalerank ?? 10,
      })
    }
  }

  const features = []
  for (const group of byName.values()) {
    // Union-find the segments into spatially-connected clusters.
    const n = group.segs.length
    const parent = Array.from({ length: n }, (_, i) => i)
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (bboxNear(group.segs[i].bbox, group.segs[j].bbox, MERGE_GAP)) parent[find(i)] = find(j)

    const clusters = new Map()
    for (let i = 0; i < n; i++) {
      const r = find(i)
      if (!clusters.has(r)) clusters.set(r, [])
      clusters.get(r).push(group.segs[i])
    }

    for (const segs of clusters.values()) {
      const lines = []
      const seen = new Set() // drop exact-duplicate lines (same river in two files)
      let isRiver = false
      let rank = 99
      for (const s of segs) {
        isRiver = isRiver || s.isRiver
        if (s.rank < rank) rank = s.rank
        for (const line of s.lines) {
          const sig = line.length + ':' + line[0]?.join(',') + '>' + line[line.length - 1]?.join(',')
          if (seen.has(sig)) continue
          seen.add(sig)
          lines.push(line)
        }
      }
      const bb = bboxOf(lines)
      const cx = round((bb[0] + bb[2]) / 2, 1)
      const cy = round((bb[1] + bb[3]) / 2, 1)
      const id = `x${fnv1a(key(group.display) + '@' + cx + ',' + cy)}`
      features.push({
        type: 'Feature',
        properties: { id, name: group.display, cla: isRiver ? 'river' : 'lake', rank },
        geometry: { type: 'MultiLineString', coordinates: lines },
      })
    }
  }

  features.sort((a, b) => a.properties.rank - b.properties.rank || a.properties.name.localeCompare(b.properties.name))
  const out = { type: 'FeatureCollection', features }
  writeFileSync(resolve(OUT, 'rivers.json'), JSON.stringify(out))
  console.log(`rivers.json: ${features.length} rivers, ${(JSON.stringify(out).length / 1e6).toFixed(2)}MB`)
}

// ── land backdrop ─────────────────────────────────────────────────────────────
function buildLand() {
  const fc = load('land50.json')
  if (!fc) return console.warn('  (skipped land: missing land50.json)')
  const features = fc.features.map((f) => {
    const g = f.geometry
    const coords =
      g.type === 'Polygon'
        ? g.coordinates.map((ring) => roundRing(ring, LAND_DECIMALS))
        : g.coordinates.map((poly) => poly.map((ring) => roundRing(ring, LAND_DECIMALS)))
    return { type: 'Feature', properties: {}, geometry: { type: g.type, coordinates: coords } }
  })
  const out = { type: 'FeatureCollection', features }
  writeFileSync(resolve(OUT, 'land.json'), JSON.stringify(out))
  console.log(`land.json: ${features.length} polys, ${(JSON.stringify(out).length / 1e6).toFixed(2)}MB`)
}

buildRivers()
buildLand()
