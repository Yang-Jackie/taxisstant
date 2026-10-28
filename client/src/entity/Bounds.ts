/** A rectangle on the map, in WGS 84 degrees (the design model's Bounds). */
export interface Bounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/** The part of the map on screen: its bounds and zoom level (FR-1.5.3: markers follow moves and zooms). */
export interface Viewport {
  /** What to load markers for: the screen plus a margin, so markers just off screen are ready. */
  readonly bounds: Bounds;
  readonly zoom: number;
  /** Exactly what is on screen, when known; `bounds` otherwise. */
  readonly screen?: Bounds;
}
