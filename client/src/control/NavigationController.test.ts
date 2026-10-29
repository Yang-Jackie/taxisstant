// Package 8 acceptance tests — NavigationController «control»: UC 0012 NavigateTo. Ask first (step 3) unless the
// driver said not to (step 2), then hand off to Google Maps (step 4); No closes the prompt (4a). D39, D41.
import { describe, expect, it, vi } from "vitest";
import { Location } from "../entity/Location";
import { NavigationController, type NavigationTarget } from "./NavigationController";
import { SettingsController } from "./SettingsController";

function memoryStore(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return { data, read: async (k: string) => data.get(k), write: async (k: string, v: unknown) => void data.set(k, v) };
}

const suntec: NavigationTarget = { location: new Location(1.29375, 103.85718), name: "Suntec City" };

function setUp(store = memoryStore()) {
  const settings = new SettingsController(store);
  const gateway = { openDeepLink: vi.fn<(dest: Location) => void>() };
  const navigation = new NavigationController(settings, gateway);
  return { store, settings, gateway, navigation };
}

describe("NavigationController", () => {
  it("asks first: navigateTo only puts up the prompt (step 3)", () => {
    const { gateway, navigation } = setUp();

    navigation.navigateTo(suntec);

    expect(navigation.getSnapshot().pending).toBe(suntec);
    expect(gateway.openDeepLink).not.toHaveBeenCalled();
  });

  it("opens Google Maps to the place on Yes, and closes the prompt (step 4)", () => {
    const { gateway, navigation } = setUp();
    navigation.navigateTo(suntec);

    navigation.confirm(true, false);

    expect(gateway.openDeepLink).toHaveBeenCalledExactlyOnceWith(suntec.location);
    expect(navigation.getSnapshot().pending).toBeNull();
  });

  it("only closes the prompt on No (4a)", () => {
    const { gateway, navigation } = setUp();
    navigation.navigateTo(suntec);

    navigation.confirm(false, false);

    expect(gateway.openDeepLink).not.toHaveBeenCalled();
    expect(navigation.getSnapshot().pending).toBeNull();
  });

  it("with 'Do not show this again' and Yes, opens Google Maps at once from then on, and saves that (step 2)", async () => {
    const { store, settings, gateway, navigation } = setUp();
    navigation.navigateTo(suntec);

    navigation.confirm(true, true);
    await vi.waitFor(() => expect(store.data.get("preferences")).toMatchObject({ skipNavPrompt: true }));
    navigation.navigateTo(suntec);

    expect(settings.getPreferences().skipNavPrompt).toBe(true);
    expect(gateway.openDeepLink).toHaveBeenCalledTimes(2);
    expect(navigation.getSnapshot().pending).toBeNull();
  });

  it("remembers nothing from 'Do not show this again' with No: skipping means always opening (D39)", () => {
    const { settings, navigation } = setUp();
    navigation.navigateTo(suntec);

    navigation.confirm(false, true);

    expect(settings.getPreferences().skipNavPrompt).toBe(false);
  });

  it("opens Google Maps before saving anything, while the tap still lets the browser open it", () => {
    const { gateway, navigation } = setUp({ ...memoryStore(), write: () => new Promise<undefined>(() => {}) } as never);
    navigation.navigateTo(suntec);
    navigation.confirm(true, true); // the save never finishes
    expect(gateway.openDeepLink).toHaveBeenCalledOnce();
  });

  it("ignores an answer when nothing is waiting for one", () => {
    const { gateway, navigation } = setUp();
    navigation.confirm(true, true);
    expect(gateway.openDeepLink).not.toHaveBeenCalled();
  });

  it("goes straight to Google Maps for a driver who chose that in an earlier session", async () => {
    const { settings, gateway, navigation } = setUp(memoryStore({ preferences: { skipNavPrompt: true } }));
    await settings.load();

    navigation.navigateTo(suntec);

    expect(gateway.openDeepLink).toHaveBeenCalledOnce();
    expect(navigation.getSnapshot().pending).toBeNull();
  });
});
