// The bundled river + land geometry. Both files are baked into the build (see
// scripts/build-data.mjs → scripts/build-topo.mjs), so the app is fully offline: no
// tiles, no network, and under the app sandbox it literally cannot phone home. Rivers
// come from Natural Earth (public domain), grouped so one logical river is one feature.
//
// Ships as TopoJSON (delta-encoded integers on a quantized grid) — roughly half the
// bytes of the raw GeoJSON — and is decoded straight back to GeoJSON here at load, so
// everything downstream (RiverMap, poster, list) still sees plain d3-geo features.
//
// `rivers-full` is the lossless-ish variant (every river + vertex, ~100m precision).
// To ship the smaller, generalized variant instead (~1/2 the size, every river kept
// but shapes simplified), swap the import below for '~/data/rivers-lite.topo.json'.

import { geoCentroid, type GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
import riversTopo from '~/data/rivers-full.topo.json'
import landTopo from '~/data/land.topo.json'
import type { River } from './types'

export interface RiverProps {
  id: string
  name: string
  cla: string
  rank: number
}
export interface RiverFeature {
  type: 'Feature'
  properties: RiverProps
  geometry: { type: 'MultiLineString'; coordinates: [number, number][][] }
}
interface FeatureCollectionLike {
  type: 'FeatureCollection'
  features: RiverFeature[]
}

// Decode the topologies back into GeoJSON FeatureCollections. `feature()` expands the
// named object; both were written as a single object per file (see build-topo.mjs).
const riversFc = feature(riversTopo, (riversTopo as { objects: { rivers: unknown } }).objects.rivers)
const landFc = feature(landTopo, (landTopo as { objects: { land: unknown } }).objects.land)

export const RIVER_FEATURES = (riversFc as unknown as FeatureCollectionLike).features
export const LAND = landFc as unknown as GeoJSON.FeatureCollection

export const RIVERS: River[] = RIVER_FEATURES.map((f) => f.properties)

const FEATURE_BY_ID = new Map<string, RiverFeature>()
const RIVER_BY_ID = new Map<string, River>()
for (const f of RIVER_FEATURES) {
  FEATURE_BY_ID.set(f.properties.id, f)
  RIVER_BY_ID.set(f.properties.id, f.properties)
}

export function featureById(id: string): RiverFeature | undefined {
  return FEATURE_BY_ID.get(id)
}
export function riverById(id: string): River | undefined {
  return RIVER_BY_ID.get(id)
}

// A representative [lon, lat] for each river, for "fly to" from the list. Computed
// lazily and cached — geoCentroid over a whole river isn't free, and most rivers
// are never targeted.
const CENTROIDS = new Map<string, [number, number]>()
export function riverCentroid(id: string): [number, number] | null {
  const cached = CENTROIDS.get(id)
  if (cached) return cached
  const f = FEATURE_BY_ID.get(id)
  if (!f) return null
  const c = geoCentroid(f as unknown as GeoPermissibleObjects) as [number, number]
  if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null
  CENTROIDS.set(id, c)
  return c
}
