import type { Carpark } from "./Carpark";
import type { ChargingStation } from "./ChargingStation";
import type { FuelStation } from "./FuelStation";
import type { HawkerCentre } from "./HawkerCentre";
import type { Hotspot } from "./Hotspot";
import type { LayerType } from "./LayerType";
import type { Locatable } from "./Locatable";
import type { Taxi } from "./Taxi";
import type { TaxiStand } from "./TaxiStand";

export interface LayerItems {
  TAXI_STAND: TaxiStand;
  TAXIS: Taxi;
  HOTSPOT: Hotspot;
  CARPARK: Carpark;
  FUEL: FuelStation;
  CHARGING: ChargingStation;
  HAWKER: HawkerCentre;
}

export class MapDataRepository {
  private readonly layers = new Map<LayerType, Locatable[]>();

  getByLayerType<K extends LayerType>(t: K): LayerItems[K][] {
    return [...(this.layers.get(t) ?? [])] as LayerItems[K][];
  }

  replaceLayer<K extends LayerType>(t: K, items: LayerItems[K][]): void {
    this.layers.set(t, [...items]);
  }

  /**
   * Sets each item's live availability from `values` (by id), as reported at `asOf`; an item missing from `values`
   * becomes unknown. Items are replaced by updated copies, so arrays handed out before keep their old values.
   */
  updateAvailability(t: "CARPARK" | "CHARGING", values: ReadonlyMap<string, number>, asOf: Date): void {
    if (t === "CARPARK") {
      this.replaceLayer(
        t,
        this.getByLayerType(t).map((c) => c.withAvailability(values.get(c.id), asOf)),
      );
    } else {
      this.replaceLayer(
        t,
        this.getByLayerType(t).map((c) => c.withAvailability(values.get(c.id), asOf)),
      );
    }
  }
}
