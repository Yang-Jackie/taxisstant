import { useEffect, useState, type RefObject } from "react";

/** How far the controls over the map reach in from its top and bottom edges, in pixels. */
export interface MapInsets {
  readonly top: number;
  readonly bottom: number;
}

const NONE: MapInsets = { top: 0, bottom: 0 };

/** The elements marked `data-map-overlay="top"` or `"bottom"` inside `root`, measured against it. */
function measure(root: HTMLElement): MapInsets {
  const box = root.getBoundingClientRect();
  let top = 0;
  let bottom = 0;
  for (const el of root.querySelectorAll<HTMLElement>("[data-map-overlay]")) {
    const r = el.getBoundingClientRect();
    if (el.dataset.mapOverlay === "top") top = Math.max(top, r.bottom - box.top);
    else bottom = Math.max(bottom, box.bottom - r.top);
  }
  return { top, bottom };
}

/**
 * How far the controls over the map reach in: the menu and language buttons and the location banner from the top,
 * the layer sheet from the bottom. They change size with the text, the banner comes and goes, and the sheet expands;
 * a ResizeObserver reports each one's size when it starts watching and whenever it changes. It is set up again after
 * every render, so an element that has just appeared is watched too.
 */
export function useMapInsets(container: RefObject<HTMLElement | null>): MapInsets {
  const [insets, setInsets] = useState<MapInsets>(NONE);
  useEffect(() => {
    const root = container.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = measure(root);
      setInsets((old) => (old.top === next.top && old.bottom === next.bottom ? old : next));
    });
    observer.observe(root);
    for (const el of root.querySelectorAll("[data-map-overlay]")) observer.observe(el);
    return () => observer.disconnect();
  });
  return insets;
}
