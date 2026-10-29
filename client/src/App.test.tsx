// M6 acceptance tests — the whole app, wired the real way: initControllers() → startControllers() → <App>.
// A fake server stands in for fetch; IndexedDB is the in-memory one from test-setup.ts (empty per test).
// M7: after one online session, the stands work with the server down (D1).
// Package 2b: every static layer is downloaded at startup (D18) and clustered while zoomed out (D17).
// Package 6: the driver's position (UC 0013). Package 7: smart suggestions from the side menu (UC 0008/0009).
// Package 8: bookmarks (UC 0011) and navigation to Google Maps (UC 0012). Package 9a: the Settings page (FR-2).
// Package 9b: English and Chinese (FR-2.1.2).
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ControllersContext, initControllers, startControllers } from "./startup";
import { LocalStore } from "./services/LocalStore";
import { fakeGeolocation } from "./testing/fakeGps";
import { callsTo, fakeServer, offline, ok, ORCHARD, PICKUPS, status, type Answer } from "./testing/fakeServer";

const STATIC_PATHS = ["/taxi-stands", "/carparks", "/fuel-stations", "/charging-stations", "/hawker-centres"];

function serve(answers: Record<string, Answer> = {}) {
  const fetchFn = fakeServer(answers);
  vi.stubGlobal("fetch", fetchFn);
  return fetchFn;
}

/** Opens the app the way main.tsx does. Calling it again in the same test is "reloading the page". */
async function openApp() {
  const controllers = initControllers();
  await startControllers(controllers);
  return render(
    <ControllersContext.Provider value={controllers}>
      <App />
    </ControllersContext.Provider>,
  );
}

/** How many landmarks the map shows: a single marker counts one, a cluster bubble counts its number (D17). */
function shown(container: HTMLElement): number {
  return [...container.querySelectorAll(".leaflet-marker-icon")].reduce(
    (n, el) => n + (el.classList.contains("marker-cluster") ? Number(el.textContent) : 1),
    0,
  );
}
const button = (name: string) => screen.getByRole("button", { name });
const taxiStandsButton = () => button("Taxi stands");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("style"); // the text size and theme a test set (package 9a)
  document.documentElement.removeAttribute("data-theme");
});

describe("App (with controllers)", () => {
  it("starts with every layer off, and downloads the static layers in the background (D18)", async () => {
    const fetchFn = serve();
    const { container } = await openApp();

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(shown(container)).toBe(0);
    for (const path of STATIC_PATHS) expect(callsTo(fetchFn, path), path).toBe(1);
  });

  it("shows the stands as soon as Taxi stands is turned on, without downloading them again", async () => {
    const fetchFn = serve();
    const { container } = await openApp();

    await userEvent.click(taxiStandsButton());

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(shown(container)).toBe(3));
    expect(callsTo(fetchFn, "/taxi-stands")).toBe(1);
  });

  it("merges nearby markers into a bubble with a count while zoomed out over the island (D17)", async () => {
    serve();
    const { container } = await openApp();

    await userEvent.click(taxiStandsButton()); // three stands within 400 m in Orchard

    await waitFor(() => expect(screen.getByTitle("3 taxi stands: tap to zoom in")).toHaveTextContent("3"));
    expect(container.querySelectorAll(".leaflet-marker-icon")).toHaveLength(1);
  });

  it("remembers Taxi stands is on after a reload, and shows them again (UC 0001 step 6)", async () => {
    serve();
    const first = await openApp();
    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(shown(first.container)).toBe(3));
    first.unmount();

    const reopened = await openApp();

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(shown(reopened.container)).toBe(3));
  });

  it("remembers that it was turned off, too", async () => {
    serve();
    const first = await openApp();
    await userEvent.click(taxiStandsButton());
    await userEvent.click(taxiStandsButton());
    first.unmount();

    const reopened = await openApp();

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(shown(reopened.container)).toBe(0);
  });

  it("doesn't download anything again when layers are toggled off and on in the same session", async () => {
    const fetchFn = serve();
    const { container } = await openApp();

    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(shown(container)).toBe(3));
    await userEvent.click(taxiStandsButton());
    await userEvent.click(taxiStandsButton());
    await userEvent.click(button("Carpark"));

    await waitFor(() => expect(shown(container)).toBe(5));
    for (const path of STATIC_PATHS) expect(callsTo(fetchFn, path), path).toBe(1); // only live data is asked for again
  });

  it("shows a toast and switches the toggle back off when the stands can't be loaded (exception 4a)", async () => {
    const fetchFn = serve({ "/taxi-stands": status(503) });
    const { container } = await openApp();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // a failed background download says nothing

    await userEvent.click(taxiStandsButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load taxi stand markers/i);
    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(shown(container)).toBe(0);
    expect(callsTo(fetchFn, "/taxi-stands")).toBe(2); // the toggle tried again
  });

  it("gives each layer its own toast (UC 0004–0007)", async () => {
    serve({ "/charging-stations": status(503) });
    await openApp();

    await userEvent.click(button("Charge"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load charging point markers/i);
    expect(button("Charge")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps each layer's toggle independent", async () => {
    serve();
    await openApp();

    await userEvent.click(button("Fuel"));
    await userEvent.click(button("Hotspots"));
    await userEvent.click(button("Fuel"));

    expect(button("Fuel")).toHaveAttribute("aria-pressed", "false");
    expect(button("Hotspots")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows fuel stations with the OpenStreetMap credit their licence requires (D12)", async () => {
    serve();
    const { container } = await openApp();

    await userEvent.click(button("Fuel"));

    await waitFor(() => expect(shown(container)).toBe(1));
    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toBeInTheDocument();
  });

  it("after one online session, Taxi stands still toggle on with no connection (M7)", async () => {
    serve();
    const first = await openApp();
    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(shown(first.container)).toBe(3));
    await userEvent.click(taxiStandsButton());
    first.unmount();

    serve({ "*": offline });
    const reopened = await openApp();
    await userEvent.click(taxiStandsButton());

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(shown(reopened.container)).toBe(3));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens with the saved stands already on the map when there's no connection (M7)", async () => {
    serve();
    const first = await openApp();
    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(shown(first.container)).toBe(3));
    first.unmount();

    serve({ "*": offline });
    const reopened = await openApp();

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    expect(shown(reopened.container)).toBe(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("works offline for every static layer after one online session, even layers never turned on (D18)", async () => {
    serve();
    (await openApp()).unmount(); // online once; nothing toggled

    serve({ "*": offline });
    const { container } = await openApp();
    for (const name of ["Carpark", "Fuel", "Charge", "Hawker food"]) await userEvent.click(button(name));

    await waitFor(() => expect(shown(container)).toBe(2 + 1 + 1 + 1)); // carparks, fuel, chargers, hawker centres
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// Package 2d — live layers in the whole app.
describe("App — live layers (package 2d)", () => {
  it("shows nearby taxis when turned on (UC 0002), clustered over the island", async () => {
    const fetchFn = serve();
    const { container } = await openApp();

    await userEvent.click(button("Nearby taxis"));

    await waitFor(() => expect(shown(container)).toBe(4));
    expect(callsTo(fetchFn, "/taxis")).toBeGreaterThanOrEqual(1);
  });

  it("shows busy stations as hotspots when turned on (UC 0003)", async () => {
    serve();
    await openApp();

    await userEvent.click(button("Hotspots"));

    expect(await screen.findByTitle("City Hall: very crowded")).toBeInTheDocument();
    expect(screen.getByTitle("Dhoby Ghaut: crowded")).toBeInTheDocument();
    expect(screen.queryByTitle(/Jurong East/)).not.toBeInTheDocument(); // LOW isn't a hotspot (D23)
  });

  it("gives nearby taxis their toast and switches back when they can't be loaded", async () => {
    serve({ "/taxis": status(503) });
    await openApp();

    await userEvent.click(button("Nearby taxis"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load nearby taxi markers/i);
    expect(button("Nearby taxis")).toHaveAttribute("aria-pressed", "false");
  });

  it("pauses polling while the page is hidden, and asks again when it is shown (D25)", async () => {
    const fetchFn = serve();
    const { container } = await openApp();
    await userEvent.click(button("Nearby taxis"));
    await waitFor(() => expect(shown(container)).toBe(4)); // the first request has finished, not just started
    const before = callsTo(fetchFn, "/taxis");

    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(callsTo(fetchFn, "/taxis")).toBe(before + 1)); // coming back asks at once
  });
});

describe("App — page visibility (D25)", () => {
  it("tells the map controller when the page is hidden and shown again, so polling pauses in between", async () => {
    serve();
    const controllers = initControllers();
    await startControllers(controllers);
    const setForeground = vi.spyOn(controllers.mapDisplay, "setForeground");
    const gpsForeground = vi.spyOn(controllers.location, "setForeground");
    const visibility = vi.spyOn(document, "visibilityState", "get");
    render(
      <ControllersContext.Provider value={controllers}>
        <App />
      </ControllersContext.Provider>,
    );
    expect(setForeground).toHaveBeenLastCalledWith(true);

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(setForeground).toHaveBeenLastCalledWith(false);
    expect(gpsForeground).toHaveBeenLastCalledWith(false); // no GPS in the background either

    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(setForeground).toHaveBeenLastCalledWith(true);
    visibility.mockRestore();
  });
});

// Package 6 — location in the whole app (UC 0013).
describe("App — location (package 6)", () => {
  it("shows the driver once the GPS answers, and lets the button centre on them", async () => {
    serve();
    const gps = fakeGeolocation();
    vi.stubGlobal("navigator", { ...navigator, geolocation: gps.geolocation });
    await openApp();
    expect(screen.getByRole("button", { name: "Centre the map on my location" })).toBeDisabled();

    act(() => gps.move(1.3, 103.8));

    expect(await screen.findByTitle("You are here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Centre the map on my location" })).toBeEnabled();
  });

  it("shows the banner when location is denied, and Try again asks the GPS again (D30)", async () => {
    serve();
    const gps = fakeGeolocation();
    vi.stubGlobal("navigator", { ...navigator, geolocation: gps.geolocation });
    await openApp();
    await waitFor(() => expect(gps.watching()).toBe(true));

    act(() => gps.fail(1));

    expect(await screen.findByRole("region", { name: "Location access" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(gps.geolocation.watchPosition).toHaveBeenCalledTimes(2);
  });

  it("opens where the driver was last time (D32)", async () => {
    serve();
    vi.stubGlobal("navigator", { ...navigator, geolocation: fakeGeolocation().geolocation });
    await new LocalStore().write("lastLocation", {
      latitude: 1.35,
      longitude: 103.9,
      accuracyM: 30,
      at: "2026-10-27T10:00:00.000Z",
    });

    await openApp();

    expect(await screen.findByTitle("Your last known position")).toBeInTheDocument();
  });
});

// Package 7 — smart suggestions in the whole app (UC 0008/0009).
describe("App — smart suggestions (package 7)", () => {
  const pickupToggle = () => screen.getByRole("button", { name: /^Suggested pickup/ });

  /** Opens the app with the driver in Orchard. */
  async function openInOrchard() {
    const gps = fakeGeolocation();
    vi.stubGlobal("navigator", { ...navigator, geolocation: gps.geolocation });
    const app = await openApp();
    await waitFor(() => expect(gps.watching()).toBe(true));
    act(() => gps.move(ORCHARD.latitude, ORCHARD.longitude));
    return app;
  }

  it("turns Suggested pickup on from the side menu: its best sites, its pins and its layers (D33, D35)", async () => {
    serve();
    await openInOrchard();

    await userEvent.click(button("Open the menu"));
    await userEvent.click(pickupToggle());

    expect(await screen.findByRole("button", { name: /^Mt Elizabeth Rd/ })).toBeInTheDocument();
    expect(pickupToggle()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTitle("Suggested pickup 1: Mt Elizabeth Rd at Mt Elizabeth Hospital")).toBeInTheDocument();
    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    expect(button("Hotspots")).toHaveAttribute("aria-pressed", "true");
  });

  it("closes the menu to show a chosen site on the map", async () => {
    serve();
    await openInOrchard();
    await userEvent.click(button("Open the menu"));
    await userEvent.click(pickupToggle());

    await userEvent.click(await screen.findByRole("button", { name: /^Orchard Rd along driveway of Lucky Plaza/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("turns it off again with the layers it turned on", async () => {
    serve();
    await openInOrchard();
    await userEvent.click(button("Open the menu"));
    await userEvent.click(pickupToggle());
    await screen.findByRole("button", { name: /^Orchard Rd along driveway of Lucky Plaza/ });

    await userEvent.click(pickupToggle());

    expect(pickupToggle()).toHaveAttribute("aria-pressed", "false");
    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTitle(/^Suggested pickup/)).not.toBeInTheDocument();
  });

  it("gives the toast over the menu and stays off when no sites can be loaded (exception 2a)", async () => {
    serve({ "/pickup-sites": status(503) });
    await openInOrchard();
    await userEvent.click(button("Open the menu"));

    await userEvent.click(pickupToggle());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load pickup markers. Please check your connection.",
    );
    expect(pickupToggle()).toHaveAttribute("aria-pressed", "false");
  });

  it("suggests again when new scores arrive, e.g. on coming back to the app (D25)", async () => {
    let scores = PICKUPS;
    serve({ "/pickup-sites": (init) => ok(scores, `"${scores[2]!.score}"`)(init) });
    await openInOrchard();
    await userEvent.click(button("Open the menu"));
    await userEvent.click(pickupToggle());
    await screen.findByRole("button", { name: /^Orchard Rd along driveway of Lucky Plaza/ });
    const firstSite = () => screen.getAllByRole("listitem")[0];
    expect(firstSite()).toHaveTextContent("Mt Elizabeth");

    scores = PICKUPS.map((p) => (p.id === "A01" ? { ...p, score: 0.95 } : p)); // Lucky Plaza gets busy
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(firstSite()).toHaveTextContent("Lucky Plaza"));
    visibility.mockRestore();
  });

  it("switches a suggestion left on off at startup, with its toast, when it has nothing recent to load (2a)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T13:00:00Z"));
    serve();
    const first = await openInOrchard();
    await userEvent.click(button("Open the menu"));
    await userEvent.click(pickupToggle());
    await screen.findByRole("button", { name: /^Orchard Rd along driveway of Lucky Plaza/ });
    first.unmount();

    vi.setSystemTime(new Date("2026-10-29T13:10:00Z")); // the saved pickups are 10 minutes old
    serve({ "*": offline });
    await openApp();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load pickup markers.");
    await userEvent.click(button("Open the menu"));
    expect(pickupToggle()).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps a suggestion on after a reload, and suggests again from where the driver was", async () => {
    serve();
    const first = await openInOrchard();
    await userEvent.click(button("Open the menu"));
    await userEvent.click(pickupToggle());
    await screen.findByRole("button", { name: /^Orchard Rd along driveway of Lucky Plaza/ });
    first.unmount();

    await openApp(); // no GPS answer this time: the saved position is enough (D32)
    await userEvent.click(button("Open the menu"));

    expect(pickupToggle()).toHaveAttribute("aria-pressed", "true");
    expect(
      await screen.findByRole("button", { name: /^Orchard Rd along driveway of Lucky Plaza/ }),
    ).toBeInTheDocument();
  });
});

// Package 8 — bookmarks and navigation in the whole app (UC 0011, UC 0012).
describe("App — bookmarks and navigation (package 8)", () => {
  const menu = () => screen.getByRole("dialog", { name: "Menu" });
  /** Opens the app with the Carpark layer on, and Suntec City's details open. */
  async function openSuntec() {
    const app = await openApp();
    await userEvent.click(button("Carpark"));
    fireEvent.click(await screen.findByTitle("Suntec City"));
    await screen.findByRole("heading", { name: "Suntec City" });
    return app;
  }

  it("bookmarks a carpark with its star, lists it in the side menu, and shows it highlighted when chosen", async () => {
    serve();
    await openSuntec();

    await userEvent.click(button("Bookmark Suntec City"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Location has been favourited");
    expect(button("Remove the bookmark for Suntec City")).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(button("Open the menu"));
    await userEvent.click(within(menu()).getByRole("button", { name: /^Suntec City/ }));

    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    expect(await screen.findByTitle("Suntec City, from your bookmarks")).toHaveClass("marker-chip--highlighted");
  });

  it("keeps bookmarks after a reload", async () => {
    serve();
    const first = await openSuntec();
    await userEvent.click(button("Bookmark Suntec City"));
    first.unmount();

    await openApp();
    await userEvent.click(button("Open the menu"));

    expect(within(menu()).getByRole("button", { name: /^Suntec City/ })).toBeInTheDocument();
  });

  it("asks before opening Google Maps, and opens directions there on Yes (UC 0012)", async () => {
    serve();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await openSuntec();

    await userEvent.click(button("Navigate"));
    expect(screen.getByRole("alertdialog", { name: "Open Google Maps?" })).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    await userEvent.click(button("Yes"));

    expect(open).toHaveBeenCalledExactlyOnceWith(
      "https://www.google.com/maps/dir/?api=1&destination=1.29375%2C103.85718&travelmode=driving",
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("opens nothing on No (4a)", async () => {
    serve();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await openSuntec();

    await userEvent.click(button("Navigate"));
    await userEvent.click(button("No"));

    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("stops asking after 'Do not show this again', in this session and the next", async () => {
    serve();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const first = await openSuntec();
    await userEvent.click(button("Navigate"));
    await userEvent.click(screen.getByRole("checkbox", { name: "Do not show this again" }));
    await userEvent.click(button("Yes"));

    await userEvent.click(button("Navigate"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(open).toHaveBeenCalledTimes(2);
    first.unmount();

    await openApp(); // Carpark is still on
    fireEvent.click(await screen.findByTitle("Suntec City"));
    await userEvent.click(await screen.findByRole("button", { name: "Navigate" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(open).toHaveBeenCalledTimes(3);
  });
});

// Package 9a — the Settings page in the whole app (FR-2, D43, D44).
describe("App — settings (package 9a)", () => {
  async function openSettings() {
    await userEvent.click(button("Open the menu"));
    await userEvent.click(button("Settings"));
    return screen.getByRole("dialog", { name: "Settings" });
  }

  it("opens Settings from the side menu, and goes back to the menu (the dialog map)", async () => {
    serve();
    await openApp();
    await openSettings();
    await userEvent.click(button("Back to the menu"));
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
  });

  it("hides the Charge layer for a petrol or diesel car, and Fuel for an electric one (FR-2.1.1)", async () => {
    serve();
    await openApp();
    await userEvent.click(button("Charge"));
    await openSettings();

    await userEvent.click(screen.getByRole("radio", { name: "Petrol or diesel" }));
    expect(screen.queryByRole("button", { name: "Charge" })).not.toBeInTheDocument();
    expect(button("Fuel")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Electric" }));
    expect(button("Charge")).toHaveAttribute("aria-pressed", "false"); // it was turned off, not just hidden
    expect(screen.queryByRole("button", { name: "Fuel" })).not.toBeInTheDocument();
  });

  it("makes all the text bigger, and the whole app dark with the Night map, and keeps both after a reload", async () => {
    serve();
    const first = await openApp();
    await openSettings();

    await userEvent.click(screen.getByRole("radio", { name: /Largest$/ }));
    await userEvent.click(screen.getByRole("switch", { name: "Dark mode" }));

    expect(document.documentElement.style.fontSize).toBe("150%");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(first.container.querySelector(".leaflet-container")).not.toBeNull();
    first.unmount();
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");

    await openApp();
    expect(document.documentElement.style.fontSize).toBe("150%");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("brings the navigation prompt back after 'Do not show this again' (D39)", async () => {
    serve();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await openApp();
    await userEvent.click(button("Carpark"));
    fireEvent.click(await screen.findByTitle("Suntec City"));
    await userEvent.click(await screen.findByRole("button", { name: "Navigate" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Do not show this again" }));
    await userEvent.click(button("Yes"));

    await openSettings();
    await userEvent.click(screen.getByRole("switch", { name: "Ask before opening Google Maps" }));
    await userEvent.click(button("Close the menu"));
    await userEvent.click(button("Navigate")); // Suntec City's details are still open

    expect(screen.getByRole("alertdialog", { name: "Open Google Maps?" })).toBeInTheDocument();
    expect(open).toHaveBeenCalledOnce();
  });
});

// Package 9b — English and Chinese in the whole app (FR-2.1.2, D47).
describe("App — languages (package 9b)", () => {
  it("switches every word to Chinese with the language button, top right, and tells the browser", async () => {
    serve();
    await openApp();

    await userEvent.click(button("Switch to 中文"));

    expect(button("德士站")).toBeInTheDocument(); // the layer buttons
    expect(button("打开菜单")).toBeInTheDocument(); // the menu button's name for screen readers
    expect(document.documentElement.lang).toBe("zh-Hans");
    await userEvent.click(button("切换到English"));
    expect(button("Taxi stands")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("gives toasts in Chinese, in the use case's meaning", async () => {
    serve({ "/taxi-stands": status(503) });
    await openApp();
    await userEvent.click(button("Switch to 中文"));

    await userEvent.click(button("德士站"));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法加载德士站标记。请检查网络连接。");
  });

  it("chooses the language from the side menu's Language screen, and keeps it after a reload", async () => {
    serve();
    const first = await openApp();
    await userEvent.click(button("Open the menu"));
    await userEvent.click(button("Language"));
    await userEvent.click(screen.getByRole("radio", { name: "中文" }));
    expect(screen.getByRole("dialog", { name: "语言" })).toBeInTheDocument();
    first.unmount();

    await openApp();

    expect(button("附近德士")).toBeInTheDocument();
  });

  it("words a suggested site's summary in Chinese", async () => {
    serve();
    const gps = fakeGeolocation();
    vi.stubGlobal("navigator", { ...navigator, geolocation: gps.geolocation });
    await openApp();
    await waitFor(() => expect(gps.watching()).toBe(true));
    act(() => gps.move(ORCHARD.latitude, ORCHARD.longitude));
    await userEvent.click(button("Switch to 中文"));

    await userEvent.click(button("打开菜单"));
    await userEvent.click(screen.getByRole("button", { name: /^推荐载客点/ }));

    expect(await screen.findByText("Orchard 拥挤 · 附近有 1 辆空德士")).toBeInTheDocument();
  });
});
