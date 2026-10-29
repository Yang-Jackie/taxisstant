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
      showBookmarks: false,
      activeSuggestions: [],
      suggestionLayers: {},
      skipNavPrompt: false,
      fontSize: 100,
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
      showBookmarks: false,
      activeSuggestions: ["REST_STOP"],
      suggestionLayers: { REST_STOP: ["CARPARK", "HAWKER"] },
      skipNavPrompt: false,
      fontSize: 100,
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

describe("SettingsController — the Bookmarks filter (package 10a-3, D53)", () => {
  it("starts off, turns on and off, saves it, and load() brings it back", async () => {
    const store = memoryStore();
    const settings = new SettingsController(store);
    expect(settings.getPreferences().showBookmarks).toBe(false);

    await settings.setBookmarksShown(true);

    expect(store.data.get("preferences")).toMatchObject({ showBookmarks: true });
    const afterReload = new SettingsController(store);
    await afterReload.load();
    expect(afterReload.getPreferences().showBookmarks).toBe(true);
    await afterReload.setBookmarksShown(false);
    expect(store.data.get("preferences")).toMatchObject({ showBookmarks: false });
  });

  it("doesn't save when it's already as asked", async () => {
    const store = memoryStore();
    await new SettingsController(store).setBookmarksShown(false);
    expect(store.data.has("preferences")).toBe(false);
  });

  it("load() reads it as off when the saved value isn't a yes or no", async () => {
    const settings = new SettingsController(memoryStore({ preferences: { showBookmarks: "yes" } }));
    await settings.load();
    expect(settings.getPreferences().showBookmarks).toBe(false);
  });
});

describe("SettingsController — vehicle type, text size and dark mode (package 9a)", () => {
  /** A stand-in for the phone's light or dark setting, which a test can flip. */
  function phone(dark: boolean) {
    const listeners: (() => void)[] = [];
    return {
      matches: dark,
      addEventListener: (_type: "change", listener: () => void) => void listeners.push(listener),
      flip(to: boolean) {
        this.matches = to;
        for (const l of listeners) l();
      },
    };
  }

  it("hides charging points for a petrol or diesel car, turning them off if they were on (FR-2.1.1, D43)", async () => {
    const store = memoryStore();
    const settings = new SettingsController(store);
    await settings.setLayerVisible("CHARGING", true);
    await settings.setLayerVisible("FUEL", true);

    await settings.setVehicleType("FUEL");

    expect(settings.getPreferences().vehicleType).toBe("FUEL");
    expect([...settings.getPreferences().visibleLayers]).toEqual(["FUEL"]);
    expect(store.data.get("preferences")).toMatchObject({ vehicleType: "FUEL", visibleLayers: ["FUEL"] });
  });

  it("hides fuel stations for an electric car, and takes them from a suggestion's own layers too", async () => {
    const settings = new SettingsController(memoryStore());
    await settings.setSuggestionActive("REST_STOP", true, ["CHARGING", "FUEL", "CARPARK", "HAWKER"]);

    await settings.setVehicleType("EV");

    expect(settings.isLayerVisible("FUEL")).toBe(false);
    expect([...settings.getPreferences().suggestionLayers.get("REST_STOP")!]).toEqual([
      "CHARGING",
      "CARPARK",
      "HAWKER",
    ]);
  });

  it("shows both again once the type is unset, and saves no type", async () => {
    const store = memoryStore();
    const settings = new SettingsController(store);
    await settings.setVehicleType("EV");

    await settings.setVehicleType(undefined);

    expect(settings.getPreferences().vehicleType).toBeUndefined();
    expect(store.data.get("preferences")).not.toHaveProperty("vehicleType");
  });

  it("load() brings the type back, and drops a layer it hides that was saved as on", async () => {
    const settings = new SettingsController(
      memoryStore({ preferences: { vehicleType: "FUEL", visibleLayers: ["CHARGING", "FUEL"] } }),
    );
    await settings.load();
    expect(settings.getPreferences().vehicleType).toBe("FUEL");
    expect([...settings.getPreferences().visibleLayers]).toEqual(["FUEL"]);
  });

  it("load() ignores a type it doesn't know", async () => {
    const settings = new SettingsController(memoryStore({ preferences: { vehicleType: "DIESEL" } }));
    await settings.load();
    expect(settings.getPreferences().vehicleType).toBeUndefined();
  });

  it("starts at normal text size, saves a new one, and load() brings it back", async () => {
    const store = memoryStore();
    const settings = new SettingsController(store, phone(false));
    expect(settings.getPreferences().fontSize).toBe(100);

    await settings.setDisplay(130, false);

    expect(store.data.get("preferences")).toMatchObject({ fontSize: 130 });
    const afterReload = new SettingsController(store, phone(false));
    await afterReload.load();
    expect(afterReload.getPreferences().fontSize).toBe(130);
  });

  it("load() reads a text size it doesn't offer as normal", async () => {
    const settings = new SettingsController(memoryStore({ preferences: { fontSize: 400 } }));
    await settings.load();
    expect(settings.getPreferences().fontSize).toBe(100);
  });

  it("starts dark or light as the phone is, and follows the phone until the driver chooses (D44)", async () => {
    const store = memoryStore();
    const dark = phone(true);
    const settings = new SettingsController(store, dark);
    expect(settings.getPreferences().darkMode).toBe(true);

    dark.flip(false);
    expect(settings.getPreferences().darkMode).toBe(false);

    await settings.setDisplay(115, false); // the text size changes, dark mode doesn't: still the phone's
    dark.flip(true);
    expect(settings.getPreferences().darkMode).toBe(true);
    expect(store.data.get("preferences")).not.toHaveProperty("darkMode");
  });

  it("keeps the driver's dark mode once chosen, whatever the phone does, and saves it", async () => {
    const store = memoryStore();
    const dark = phone(true);
    const settings = new SettingsController(store, dark);

    await settings.setDisplay(100, false);
    dark.flip(false);
    dark.flip(true);

    expect(settings.getPreferences().darkMode).toBe(false);
    expect(store.data.get("preferences")).toMatchObject({ darkMode: false });
  });

  it("load() brings back the driver's dark mode, or else asks the phone", async () => {
    const chosen = new SettingsController(memoryStore({ preferences: { darkMode: true } }), phone(false));
    await chosen.load();
    expect(chosen.getPreferences().darkMode).toBe(true);

    const notChosen = new SettingsController(memoryStore({ preferences: { visibleLayers: [] } }), phone(true));
    await notChosen.load();
    expect(notChosen.getPreferences().darkMode).toBe(true);
  });
});

describe("SettingsController — the language (package 9b, FR-2.1.2)", () => {
  const noDark = { matches: false, addEventListener: () => {} };

  it("starts in the phone's language: Chinese for any zh, else English (D47)", () => {
    const languageFor = (tags: string[]) =>
      new SettingsController(memoryStore(), noDark, tags).getPreferences().language;
    expect(languageFor(["zh-SG"])).toBe("ZH");
    expect(languageFor(["zh-Hans-CN", "en"])).toBe("ZH");
    expect(languageFor(["en-GB", "zh-SG"])).toBe("EN");
    expect(languageFor(["ms-MY", "zh-TW"])).toBe("ZH"); // the first the app speaks
    expect(languageFor(["ta-SG"])).toBe("EN");
  });

  it("saves a chosen language, which load() brings back whatever the phone says", async () => {
    const store = memoryStore();
    await new SettingsController(store, noDark, ["en"]).setLanguage("ZH");

    expect(store.data.get("preferences")).toMatchObject({ language: "ZH" });
    const afterReload = new SettingsController(store, noDark, ["en"]);
    await afterReload.load();
    expect(afterReload.getPreferences().language).toBe("ZH");
  });

  it("doesn't save the phone's language as a choice", async () => {
    const store = memoryStore();
    const settings = new SettingsController(store, noDark, ["zh-SG"]);
    await settings.setLayerVisible("FUEL", true);
    expect(store.data.get("preferences")).not.toHaveProperty("language");
  });

  it("saves choosing the phone's own language, so it stays if the phone changes later", async () => {
    const store = memoryStore();
    await new SettingsController(store, noDark, ["en"]).setLanguage("EN");
    expect(store.data.get("preferences")).toMatchObject({ language: "EN" });
  });

  it("load() goes by the phone when the saved language is one it doesn't know", async () => {
    const settings = new SettingsController(memoryStore({ preferences: { language: "FR" } }), noDark, ["zh"]);
    await settings.load();
    expect(settings.getPreferences().language).toBe("ZH");
  });
});
