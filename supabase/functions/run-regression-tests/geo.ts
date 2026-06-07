// Pure Web Mercator helpers extracted from index.ts so they can be
// unit-tested in isolation. Keep these dependency-free.

export const TILE_SIZE = 256;

export function lngToWorldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE_SIZE * Math.pow(2, z);
}

export function latToWorldY(lat: number, z: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return (
    (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) *
    TILE_SIZE *
    Math.pow(2, z)
  );
}

/**
 * Approximate fractional zoom that fits the bounding box into
 * pixelWidth x pixelHeight. MUST return a fractional value — flooring
 * to an integer was the root cause of the 2026-06-07 snapshot bug,
 * which zoomed out so far that a US-bounded map showed the hemisphere.
 */
export function zoomForBounds(
  north: number, south: number, east: number, west: number,
  pixelWidth: number, pixelHeight: number,
): number {
  const WORLD = TILE_SIZE;
  const latRad = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const latFraction = (latRad(north) - latRad(south)) / (2 * Math.PI);
  const lngDiff = east - west;
  const lngFraction = ((lngDiff < 0 ? lngDiff + 360 : lngDiff)) / 360;
  const latZoom = Math.log2(pixelHeight / WORLD / latFraction);
  const lngZoom = Math.log2(pixelWidth / WORLD / lngFraction);
  return Math.max(0, Math.min(18, Math.min(latZoom, lngZoom)));
}
