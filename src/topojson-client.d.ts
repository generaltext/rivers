// Minimal ambient types for topojson-client (no bundled types, and we only use
// `feature` to decode a topology object back into a GeoJSON FeatureCollection).
declare module 'topojson-client' {
  export function feature(
    topology: unknown,
    object: unknown,
  ): { type: 'FeatureCollection'; features: unknown[] }
}
