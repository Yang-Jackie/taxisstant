// Package 2b tests — LandmarkDetails: what a marker's popup says, per layer.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Carpark } from "../entity/Carpark";
import { ChargingStation } from "../entity/ChargingStation";
import { FuelStation } from "../entity/FuelStation";
import { HawkerCentre } from "../entity/HawkerCentre";
import { Location } from "../entity/Location";
import { TaxiStand } from "../entity/TaxiStand";
import { LandmarkDetails } from "./LandmarkDetails";

const at = (address?: string) => new Location(1.3, 103.8, address);
const text = () => screen.getByRole("heading").parentElement!.textContent;

describe("LandmarkDetails", () => {
  it("names the landmark in a heading", () => {
    render(<LandmarkDetails item={new Carpark({ id: "1", name: "Suntec City", location: at(), agency: "LTA" })} />);
    expect(screen.getByRole("heading", { name: "Suntec City" })).toBeInTheDocument();
  });

  it("taxi stand: stand or stop, and barrier-free access", () => {
    render(
      <LandmarkDetails
        item={
          new TaxiStand({ id: "A06", name: "Cairnhill Nine", location: at(), standType: "Stop", isBarrierFree: true })
        }
      />,
    );
    expect(text()).toContain("Taxi stop");
    expect(text()).toContain("Barrier-free access");
  });

  it("carpark: who runs it, and LTA's area", () => {
    render(
      <LandmarkDetails
        item={new Carpark({ id: "1", name: "Suntec City", location: at(), agency: "LTA", area: "Marina" })}
      />,
    );
    expect(text()).toContain("LTA carpark · Marina");
  });

  it("fuel station: brand (unless the name says it), address and opening hours", () => {
    const station = new FuelStation({
      id: "way/1",
      name: "Upper Bukit Timah",
      brand: "Shell",
      location: at("772 Upper Bukit Timah Road"),
      openingHours: "24/7",
    });
    render(<LandmarkDetails item={station} />);
    expect(text()).toContain("Shell");
    expect(text()).toContain("772 Upper Bukit Timah Road");
    expect(text()).toContain("Open 24/7");
  });

  it("charging station: how many chargers, how fast, which plugs, who runs them", () => {
    const station = new ChargingStation({
      id: "x",
      name: "CLARKE QUAY",
      location: at("3E RIVER VALLEY ROAD"),
      operators: ["SP MOBILITY PTE. LTD."],
      chargePoints: 3,
      maxPowerKw: 50,
      hasDcFast: true,
      plugTypes: ["Combo 2", "Type 2"],
    });
    render(<LandmarkDetails item={station} />);
    expect(text()).toContain("3 chargers · up to 50 kW · DC fast");
    expect(text()).toContain("Combo 2, Type 2");
    expect(text()).toContain("SP MOBILITY PTE. LTD.");
  });

  const adam = new HawkerCentre({
    id: "adam-road-food-centre",
    name: "Adam Road Food Centre",
    location: at("2, Adam Road, Singapore 289876"),
    foodStalls: 32,
    marketStalls: 0,
    closures: [
      { from: "2026-12-07", to: "2026-12-08", reason: "cleaning" },
      { from: "2026-06-08", to: "2026-08-07", reason: "works", remarks: "Repairs and Redecoration" },
    ],
  });

  it("hawker centre: address, stalls, and the next closure (D13)", () => {
    render(<LandmarkDetails item={adam} now={new Date("2026-10-28T12:00:00+08:00")} />);
    expect(text()).toContain("32 food stalls");
    expect(text()).toContain("Next closed 7 Dec – 8 Dec for cleaning");
  });

  it("hawker centre: warns when it is closed today, and says why and until when", () => {
    render(<LandmarkDetails item={adam} now={new Date("2026-07-01T12:00:00+08:00")} />);
    expect(text()).toContain("Closed today for repairs and redecoration, until 7 Aug");
  });
});
