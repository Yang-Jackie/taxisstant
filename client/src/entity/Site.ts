import type { Locatable } from "./Locatable";
import type { Location } from "./Location";

export interface SiteProps {
  id: string;
  centre: Location;
  /** In metres (D6). */
  radius: number;
}

/** An area on the map, a centre plus a radius: the design model's Site (Hotspot, and later the suggested sites). */
export abstract class Site implements Locatable {
  readonly id: string;
  readonly centre: Location;
  readonly radius: number;

  constructor(props: SiteProps) {
    this.id = props.id;
    this.centre = props.centre;
    this.radius = props.radius;
  }

  getLocation(): Location {
    return this.centre;
  }

  contains(loc: Location): boolean {
    return this.centre.distanceTo(loc) <= this.radius;
  }
}
