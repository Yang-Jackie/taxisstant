// M6 acceptance tests — SettingsController «control»: the only owner of which layers are visible (D3),
// saved through LocalStore so they survive a reload (UC 0001 step 6, FR-2.2.1).
// Package 7: which suggestions are on (UC 0008/0009 step 7), and the layers each one turned on itself (D35).
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

    expect(store.data.get("preferences")).toEqual({
      visibleLayers: ["TAXI_STAND"],
      activeSuggestions: [],
      suggestionLayers: {},
      skipNavPrompt: false,
    });
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

  it("load() reads a save from before suggestions existed: no suggestions on", async () => {
    const settings = new SettingsController(memoryStore({ preferences: { visibleLayers: ["FUEL"] } }));
    await settings.load();
    expect(settings.isLayerVisible("FUEL")).toBe(true);
    expect(settings.getPreferences().activeSuggestions.size).toBe(0);
  });
});

describe("SettingsController — suggestions (package 7, D35)", () => {
  it("turns a suggestion on with those of its layers that were off, and says which", async () => {
    const settings = new SettingsController(memoryStore());
    await settings.setLayerVisible("TAXI_STAND", true); // the driver's own

    const turnedOn = await settings.setSuggestionActive("PICKUP", true, ["TAXI_STAND", "TAXIS", "HOTSPOT"]);

    expect(turnedOn).toEqual(["TAXIS", "HOTSPOT"]);
    expect(settings.isSuggestionActive("PICKUP")).toBe(true);
    expect([...settings.getPreferences().visibleLayers].sort()).toEqual(["HOTSPOT", "TAXIS", "TAXI_STAND"]);
    expect([...settings.getPreferences().suggestionLayers.get("PICKUP")!]).toEqual(["TAXIS", "HOTSPOT"]);
  });

  it("turns it off with only the layers it turned on: the driver's own stay on", async () => {
    const settings = new SettingsController(memoryStore());
    await settings.setLayerVisible("TAXI_STAND", true);
    await settings.setSuggestionActive("PICKUP", true, ["TAXI_STAND", "TAXIS", "HOTSPOT"]);

    const turnedOff = await settings.setSuggestionActive("PICKUP", false);

    expect(turnedOff).toEqual(["TAXIS", "HOTSPOT"]);
    expect(settings.isSuggestionActive("PICKUP")).toBe(false);
    expect([...settings.getPreferences().visibleLayers]).toEqual(["TAXI_STAND"]);
    expect(settings.getPreferences().suggestionLayers.has("PICKUP")).toBe(false);
  });

  it("gives a layer back to the driver once they toggle it: turning the suggestion off leaves it alone", async () => {
    const settings = new SettingsController(memoryStore());
    await settings.setSuggestionActive("PICKUP", true, ["TAXI_STAND", "TAXIS", "HOTSPOT"]);
    await settings.setLayerVisible("TAXIS", false); // the driver turns taxis off and on again
    await settings.setLayerVisible("TAXIS", true);

    const turnedOff = await settings.setSuggestionActive("PICKUP", false);

    expect(turnedOff).toEqual(["TAXI_STAND", "HOTSPOT"]);
    expect(settings.isLayerVisible("TAXIS")).toBe(true);
  });

  it("does nothing, and saves nothing, when the suggestion is already as asked", async () => {
    const store = memoryStore();
    const settings = new SettingsController(store);

    expect(await settings.setSuggestionActive("REST_STOP", false)).toEqual([]);
    expect(store.data.has("preferences")).toBe(false);
  });

  it("saves suggestions and their layers as plain arrays, and load() brings them back", async () => {
    const store = memoryStore();
    await new SettingsController(store).setSuggestionActive("REST_STOP", true, ["CARPARK", "HAWKER"]);

    expect(store.data.get("preferences")).toEqual({
      visibleLayers: ["CARPARK", "HAWKER"],
      activeSuggestions: ["REST_STOP"],
      suggestionLayers: { REST_STOP: ["CARPARK", "HAWKER"] },
      skipNavPrompt: false,
    });
    const afterReload = new SettingsController(store);
    await afterReload.load();
    expect(afterReload.isSuggestionActive("REST_STOP")).toBe(true);
    expect([...afterReload.getPreferences().suggestionLayers.get("REST_STOP")!]).toEqual(["CARPARK", "HAWKER"]);
  });

  it("load() keeps only real names, and only layers that are on, owned by suggestions that are on", async () => {
    const settings = new SettingsController(
      memoryStore({
        preferences: {
          visibleLayers: ["CARPARK", "TAXIS"],
          activeSuggestions: ["REST_STOP", "PARTY", 7],
          suggestionLayers: { REST_STOP: ["CARPARK", "HAWKER", "BUS"], PICKUP: ["TAXIS"] },
        },
      }),
    );
    await settings.load();

    expect([...settings.getPreferences().activeSuggestions]).toEqual(["REST_STOP"]);
    expect([...settings.getPreferences().suggestionLayers.get("REST_STOP")!]).toEqual(["CARPARK"]); // HAWKER is off
    expect(settings.getPreferences().suggestionLayers.has("PICKUP")).toBe(false); // PICKUP is off
  });

  it("load() ignores a field of the wrong shape and keeps the rest", async () => {
    const settings = new SettingsController(
      memoryStore({ preferences: { visibleLayers: ["FUEL"], activeSuggestions: "PICKUP", suggestionLayers: [] } }),
    );
    await settings.load();
    expect(settings.isLayerVisible("FUEL")).toBe(true);
    expect(settings.getPreferences().activeSuggestions.size).toBe(0);
  });
});

describe("SettingsController — the navigation prompt (package 8)", () => {
  it("shows the prompt until told not to, saves that, and load() brings it back (UC 0012 step 2)", async () => {
    const store = memoryStore();
    const settings = new SettingsController(store);
    expect(settings.getPreferences().skipNavPrompt).toBe(false);

    await settings.setSkipNavPrompt(true);

    expect(store.data.get("preferences")).toMatchObject({ skipNavPrompt: true });
    const afterReload = new SettingsController(store);
    await afterReload.load();
    expect(afterReload.getPreferences().skipNavPrompt).toBe(true);
  });

  it("load() shows the prompt when the saved value isn't a yes or no", async () => {
    const settings = new SettingsController(memoryStore({ preferences: { skipNavPrompt: "yes" } }));
    await settings.load();
    expect(settings.getPreferences().skipNavPrompt).toBe(false);
  });
});
