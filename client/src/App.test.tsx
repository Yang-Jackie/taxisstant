// M5 acceptance tests — App: the map, the toggles and the real server working together (UC 0001).
// The browser's fetch is replaced with a fake server, so these tests never need the real one running.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const stands = [
  { id: "A01", name: "Orchard Rd along driveway of Lucky Plaza", latitude: 1.304294727, longitude: 103.8338467, standType: "Stand", isBarrierFree: true },
  { id: "A05", name: "Mt Elizabeth Rd at Mt Elizabeth Hospital", latitude: 1.304571786, longitude: 103.835547, standType: "Stand", isBarrierFree: true },
  { id: "A06", name: "Cairnhill Rd at Cairnhill Nine", latitude: 1.303519805, longitude: 103.8376729, standType: "Stop", isBarrierFree: true },
];
const okBody = { asOf: "2026-10-26T12:00:00.000Z", etag: '"v1"', data: stands };

/** Replaces the browser's fetch for one test. */
function fakeServer(answer: () => Promise<Response>) {
  const fetchFn = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(answer);
  vi.stubGlobal("fetch", fetchFn);
  return fetchFn;
}

const serving = () => fakeServer(async () => new Response(JSON.stringify(okBody), { status: 200 }));

function markerCount(container: HTMLElement) {
  return container.querySelectorAll(".leaflet-marker-icon").length;
}

const taxiStandsButton = () => screen.getByRole("button", { name: "Taxi stands" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("starts with Taxi stands off, no markers, and no request to the server", () => {
    const fetchFn = serving();
    const { container } = render(<App />);

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(markerCount(container)).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("loads the stands from /api/taxi-stands when Taxi stands is turned on, and shows them (UC 0001 steps 1–5)", async () => {
    const fetchFn = serving();
    const { container } = render(<App />);

    await userEvent.click(taxiStandsButton());

    await waitFor(() => expect(markerCount(container)).toBe(3));
    expect(String(fetchFn.mock.calls[0]![0])).toBe("/api/taxi-stands");
    expect(screen.getByTitle("Cairnhill Rd at Cairnhill Nine")).toBeInTheDocument();
  });

  it("turns the toggle on straight away, while the stands are still loading", async () => {
    fakeServer(() => new Promise<Response>(() => {})); // a server that never answers
    render(<App />);

    await userEvent.click(taxiStandsButton());

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("removes the markers when turned off (UC 0001 alternative flow 2a)", async () => {
    serving();
    const { container } = render(<App />);

    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(markerCount(container)).toBe(3));
    await userEvent.click(taxiStandsButton());

    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(markerCount(container)).toBe(0);
  });

  it("doesn't download the stands again when turned off and on (they're static data, D1)", async () => {
    const fetchFn = serving();
    const { container } = render(<App />);

    await userEvent.click(taxiStandsButton());
    await waitFor(() => expect(markerCount(container)).toBe(3));
    await userEvent.click(taxiStandsButton());
    await userEvent.click(taxiStandsButton());

    expect(markerCount(container)).toBe(3);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("shows a toast and switches the toggle back off when the server can't provide the stands (UC 0001 exception 4a)", async () => {
    fakeServer(async () => new Response(JSON.stringify({ error: "Taxi stand data is not loaded yet" }), { status: 503 }));
    const { container } = render(<App />);

    await userEvent.click(taxiStandsButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load taxi stand markers/i);
    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
    expect(markerCount(container)).toBe(0);
  });

  it("does the same when the network itself fails", async () => {
    fakeServer(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<App />);

    await userEvent.click(taxiStandsButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load taxi stand markers/i);
    expect(taxiStandsButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps each layer's toggle independent", async () => {
    serving();
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Fuel" }));
    await userEvent.click(screen.getByRole("button", { name: "Hotspots" }));
    await userEvent.click(screen.getByRole("button", { name: "Fuel" }));

    expect(screen.getByRole("button", { name: "Fuel" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Hotspots" })).toHaveAttribute("aria-pressed", "true");
  });
});
