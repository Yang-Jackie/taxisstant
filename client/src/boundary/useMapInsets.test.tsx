// Package 10a tests — useMapInsets: how far the controls over the map reach in, so popups open clear of them.
import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMapInsets, type MapInsets } from "./useMapInsets";

/** Gives elements the boxes a phone would lay out: by their test id, else the app's whole screen. */
function layOut(boxes: Record<string, { top: number; bottom: number }>) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const box = boxes[(this as HTMLElement).dataset.testid ?? ""] ?? { top: 0, bottom: 800 };
    return { ...box, left: 0, right: 400, width: 400, height: box.bottom - box.top, x: 0, y: box.top } as DOMRect;
  });
}

/** A stand-in for ResizeObserver: it reports at once when watching starts, as the real one does. */
class InstantResizeObserver {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
  }
  observe() {
    queueMicrotask(this.callback);
  }
  disconnect() {}
}

function Screen({ banner, report }: { banner: boolean; report: (i: MapInsets) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  report(useMapInsets(ref));
  return (
    <div ref={ref} data-testid="app">
      <button data-map-overlay="top" data-testid="menu" />
      {banner && <section data-map-overlay="top" data-testid="banner" />}
      <div data-map-overlay="bottom" data-testid="sheet" />
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useMapInsets", () => {
  it("measures how far the top controls and the bottom sheet reach into the screen", async () => {
    vi.stubGlobal("ResizeObserver", InstantResizeObserver);
    layOut({ app: { top: 0, bottom: 800 }, menu: { top: 12, bottom: 58 }, sheet: { top: 710, bottom: 800 } });
    const report = vi.fn();

    render(<Screen banner={false} report={report} />);

    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith({ top: 58, bottom: 90 }));
  });

  it("follows the location banner as it comes, below the menu button", async () => {
    vi.stubGlobal("ResizeObserver", InstantResizeObserver);
    layOut({
      app: { top: 0, bottom: 800 },
      menu: { top: 12, bottom: 58 },
      banner: { top: 68, bottom: 160 },
      sheet: { top: 590, bottom: 800 },
    });
    const report = vi.fn();
    const { rerender } = render(<Screen banner={false} report={report} />);
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith({ top: 58, bottom: 210 }));

    rerender(<Screen banner report={report} />);

    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith({ top: 160, bottom: 210 }));
  });

  it("reports nothing where the browser can't watch sizes", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const report = vi.fn();
    render(<Screen banner report={report} />);
    expect(report).toHaveBeenLastCalledWith({ top: 0, bottom: 0 });
  });
});
