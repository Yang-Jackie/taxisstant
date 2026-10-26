import type { LayerType } from "./LayerType";
import type { Locatable } from "./Locatable";
import type { TaxiStand } from "./TaxiStand";          

export interface LayerItems {                           
  TAXI_STAND: TaxiStand;
  TAXIS: Locatable; 
  HOTSPOT: Locatable;    
  CARPARK: Locatable; 
  FUEL: Locatable;
  CHARGING: Locatable; 
  HAWKER: Locatable;
}

export class MapDataRepository {
  private readonly layers = new Map<LayerType, Locatable[]>();

  getByLayerType<K extends LayerType>(t: K): LayerItems[K][] {          
    return [...(this.layers.get(t) ?? [])] as LayerItems[K][];         
  }

  replaceLayer<K extends LayerType>(t: K, items: LayerItems[K][]): void {  
    this.layers.set(t, [...items]);
  }
}
