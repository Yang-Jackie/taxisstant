// M6 acceptance tests — the whole app, wired the real way: initControllers() → startControllers() → <App>.
// A fake server stands in for fetch; IndexedDB is the in-memory one from test-setup.ts (empty per test).
// M7: after one online session, the stands work with the server down (D1).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ControllersContext, initControllers, startControllers } from "./startup";

const stands = [
  {
    id: "A01",
    name: "Orchard Rd along driveway of Lucky Plaza",
    latitude: 1.304294727,
    longitude: 103.8338467,
    standType: "Stand",
    isBarrierFree: true,
  },
  {
    id: "A05",
    name: "Mt Elizabeth Rd at Mt Elizabeth Hospital",
    latitude: 1.304571786,
    longitude: 103.835547,
    standType: "Stand",
    isBarrierFree: true,
  },
  {
    id: "A06",
    name: "Cairnhill Rd at Cairnhill Nine",
    latitude: 1.303519805,
    longitude: 103.8376729,
    standType: "Stop",
    isBarrierFree: true,
  },
];
const okBody = { asOf: "2026-10-27T00:00:00.000Z", etag: '"v1"', data: stands };

function fakeServer(answer: () => Promise<Response>) {
  const fetchFn = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(answer);
  vi.stubGlobal("fetch", fetchFn);
  return fetchFn;
}
const serving = () => fakeServer(async () => new Response(JSON.stringify(okBody), { status: 200 }));
const offline = () => fakeServer(() => Promise.reject(new TypeError("Failed to fetch")));

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

const markerCount = (container: HTMLElement) => container.querySelectorAll(".leaflet-marker-icon").length;
const taxiStandsButton = () => screen.getByRole("button", { name: "Taxi stands" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App (with controllers)", () => {
  it("starts with Taxi stands off and doesn't contact the server", async () => {
    const fetchFn = serving();
    const { container } = await openApp();

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(markerCount(container)).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("loads and shows the stands when Taxi stands is turned on", async () => {
    serving();
    const { container } = await openApp();

    await userEvent.click(taxiStandsButton());

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(markerCount(container)).toBe(3));
  });

  it("remembers Taxi stands is on after a reload, and shows them again (UC 0001 step 6)", async () => {
    serving();
    const first = await openApp();
    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(markerCount(first.container)).toBe(3));
    first.unmount();

    const reopened = await openApp();

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(markerCount(reopened.container)).toBe(3));
  });

  it("remembers that it was turned off, too", async () => {
    serving();
    const first = await openApp();
    await userEvent.click(taxiStandsButton());
    await userEvent.click(taxiStandsButton());
    first.unmount();

    const reopened = await openApp();

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(markerCount(reopened.container)).toBe(0);
  });

  it("doesn't download the stands again when toggled off and on in the same session", async () => {
    const fetchFn = serving();
    const { container } = await openApp();

    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(markerCount(container)).toBe(3));
    await userEvent.click(taxiStandsButton());
    await userEvent.click(taxiStandsButton());

    await waitFor(() => expect(markerCount(container)).toBe(3));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("shows a toast and switches the toggle back off when the stands can't be loaded (exception 4a)", async () => {
    fakeServer(async () => new Response("{}", { status: 503 }));
    const { container } = await openApp();

    await userEvent.click(taxiStandsButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load taxi stand markers/i);
    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(markerCount(container)).toBe(0);
  });

  it("keeps each layer's toggle independent", async () => {
    serving();
    await openApp();

    await userEvent.click(screen.getByRole("button", { name: "Fuel" }));
    await userEvent.click(screen.getByRole("button", { name: "Hotspots" }));
    await userEvent.click(screen.getByRole("button", { name: "Fuel" }));

    expect(screen.getByRole("button", { name: "Fuel" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Hotspots" })).toHaveAttribute("aria-pressed", "true");
  });

  it("after one online session, Taxi stands still toggle on with no connection (M7)", async () => {
    serving();
    const first = await openApp();
    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(markerCount(first.container)).toBe(3));
    await userEvent.click(taxiStandsButton());
    first.unmount();

    offline();
    const reopened = await openApp();
    await userEvent.click(taxiStandsButton());

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(markerCount(reopened.container)).toBe(3));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens with the saved stands already on the map when there's no connection (M7)", async () => {
    serving();
    const first = await openApp();
    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(markerCount(first.container)).toBe(3));
    first.unmount();

    offline();
    const reopened = await openApp();

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
    expect(markerCount(reopened.container)).toBe(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
