const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export class Location {
  readonly latitude: number;
  readonly longitude: number;
  readonly address?: string;

  constructor(latitude: number, longitude: number, address?: string) {
    if (!(latitude >= -90 && latitude <= 90)) {
      throw new RangeError(`Latitude must be between -90 and 90, got ${latitude}`);
    }
    if (!(longitude >= -180 && longitude <= 180)) {
      throw new RangeError(`Longitude must be between -180 and 180, got ${longitude}`);
    }
    this.latitude = latitude;
    this.longitude = longitude;
    this.address = address;
  }

  distanceTo(other: Location): number {
    const dLat = toRadians(other.latitude - this.latitude);
    const dLng = toRadians(other.longitude - this.longitude);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(this.latitude)) * Math.cos(toRadians(other.latitude)) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }
}
