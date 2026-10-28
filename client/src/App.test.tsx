// M6 acceptance tests — the whole app, wired the real way: initControllers() → startControllers() → <App>.
// A fake server stands in for fetch; IndexedDB is the in-memory one from test-setup.ts (empty per test).
// M7: after one online session, the stands work with the server down (D1).
// Package 2b: every static layer is downloaded at startup (D18) and clustered while zoomed out (D17).
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ControllersContext, initControllers, startControllers } from "./startup";
import { LocalStore } from "./services/LocalStore";
import { fakeGeolocation } from "./testing/fakeGps";
import { callsTo, fakeServer, offline, status, type Answer } from "./testing/fakeServer";

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
