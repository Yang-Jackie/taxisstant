import type { Locatable } from "./Locatable";
import type { StaticLayer } from "./LayerType";
import type { Location } from "./Location";

export interface LandmarkProps {
  id: string;
  name: string;
  location: Location;
}

export abstract class Landmark implements Locatable {
  readonly id: string;
  readonly name: string;
  readonly location: Location;

  getLocation(): Location {
    return this.location;
  }

  constructor(props: LandmarkProps) {
    this.id = props.id;
    this.name = props.name;
    this.location = props.location;
  }

  abstract getType(): StaticLayer;
}
