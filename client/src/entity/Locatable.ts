import type { Location } from "./Location";

export interface Locatable {
    getLocation(): Location;
}