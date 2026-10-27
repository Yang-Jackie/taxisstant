// M6 acceptance tests — SettingsController «control»: the only owner of which layers are visible (D3),
// saved through LocalStore so they survive a reload (UC 0001 step 6, FR-2.2.1).
import { describe, expect, it, vi } from "vitest";
import { SettingsController } from "./SettingsController";

/** An in-memory stand-in for LocalStore — anything with read() and write() will do. */
function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    data,
    read: async (key: string) => data.get(key),
    write: async (key: string, value: unknown) => {
      data.set(key, value);
    },
  };
}

describe("SettingsController", () => {
  it("starts with no layers visible", () => {
    const settings = new SettingsController(memoryStore());
    expect(settings.getPreferences().visibleLayers.size).toBe(0);
    expect(settings.isLayerVisible("TAXI_STAND")).toBe(false);
  });

  it("turns layers on and off", async () => {
    const settings = new SettingsController(memoryStore());

    await settings.setLayerVisible("TAXI_STAND", true);
    await settings.setLayerVisible("FUEL", true);
    await settings.setLayerVisible("FUEL", false);

    expect(settings.isLayerVisible("TAXI_STAND")).toBe(true);
    expect(settings.isLayerVisible("FUEL")).toBe(false);
  });

  it('saves the visible layers under "preferences", as a plain array', async () => {
    const store = memoryStore();
    const settings = new SettingsController(store);

    await settings.setLayerVisible("TAXI_STAND", true);

    expect(store.data.get("preferences")).toEqual({ visibleLayers: ["TAXI_STAND"] });
  });

  it("load() brings back what an earlier session saved", async () => {
    const store = memoryStore();
    await new SettingsController(store).setLayerVisible("TAXI_STAND", true);

    const afterReload = new SettingsController(store);
    await afterReload.load();

    expect(afterReload.isLayerVisible("TAXI_STAND")).toBe(true);
  });

  it("load() keeps only real layer names from storage (stored data may be old or tampered with)", async () => {
    const settings = new SettingsController(memoryStore({ preferences: { visibleLayers: ["TAXI_STAND", "BUS", 42] } }));
    await settings.load();
    expect([...settings.getPreferences().visibleLayers]).toEqual(["TAXI_STAND"]);
  });

  it("load() falls back to nothing visible when storage holds something unexpected", async () => {
    const settings = new SettingsController(memoryStore({ preferences: "hello" }));
    await settings.load();
    expect(settings.getPreferences().visibleLayers.size).toBe(0);
  });

  it("notifies subscribers on a change, and gives them a new snapshot object", async () => {
    const settings = new SettingsController(memoryStore());
    const listener = vi.fn();
    settings.subscribe(listener);
    const before = settings.getSnapshot();

    await settings.setLayerVisible("TAXI_STAND", true);

    expect(listener).toHaveBeenCalled();
    expect(settings.getSnapshot()).not.toBe(before);
  });

  it("never changes a snapshot it already handed out — each change builds a new Set", async () => {
    const settings = new SettingsController(memoryStore());
    const before = settings.getPreferences();

    await settings.setLayerVisible("TAXI_STAND", true);

    expect(before.visibleLayers.has("TAXI_STAND")).toBe(false); // the old snapshot is untouched
    expect(settings.getPreferences().visibleLayers).not.toBe(before.visibleLayers);
  });

  it("doesn't notify or save when nothing actually changes", async () => {
    const store = memoryStore();
    const settings = new SettingsController(store);
    const listener = vi.fn();
    settings.subscribe(listener);

    await settings.setLayerVisible("TAXI_STAND", false); // already off

    expect(listener).not.toHaveBeenCalled();
    expect(store.data.has("preferences")).toBe(false);
  });
});
