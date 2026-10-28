/** Approximate distance in metres between two WGS 84 points: accurate to well under 1% across Singapore. */
export function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const metresPerDegree = 111_320;
  const dLat = (a.lat - b.lat) * metresPerDegree;
  const dLon = (a.lon - b.lon) * metresPerDegree * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}
