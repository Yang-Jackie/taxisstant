// Package 2a tests — HawkerCentreAdapter: hawker centres and their closures (FR-1.1.1, D13), from NEA on data.gov.sg.
// Uses NEA's "Dates of Hawker Centres Closure" CSV recorded on 28 Oct 2026 (123 centres), as the facade returns it.
import { describe, expect, it } from "vitest";
import { loadSample } from "../../sample-data/samples.js";
import { HawkerCentreAdapter, neaDate } from "./HawkerCentreAdapter.js";

type Row = Record<string, string>;
const rows = loadSample("hawkerCentres") as Row[];
const adapter = new HawkerCentreAdapter();

describe("HawkerCentreAdapter", () => {
  describe("declares its own data source", () => {
    it("feeds the HAWKER_CENTRES dataset", () => expect(adapter.getDataset()).toBe("HAWKER_CENTRES"));
    it("comes from data.gov.sg", () => expect(adapter.getSource()).toBe("DATA_GOV_SG"));
    it("is NEA's closure dataset", () => expect(adapter.getPaths()).toEqual(["d_bda4baa634dd1cc7a6c7cad5f19e2d68"]));
    it("refreshes once a day (static data, D1)", () => expect(adapter.getRefreshInterval()).toBe(24 * 60 * 60 * 1000));
  });

  describe("prepare()", () => {
    const centres = adapter.prepare([rows]);
    const byName = (name: string) => centres.find((c) => c.name === name);

    it("keeps every centre, each with an id made from its name", () => {
      expect(centres).toHaveLength(rows.length);
      expect(byName("Adam Road Food Centre")?.id).toBe("adam-road-food-centre");
      expect(new Set(centres.map((c) => c.id)).size).toBe(centres.length);
    });

    it("turns the CSV's text into numbers", () => {
      expect(byName("Adam Road Food Centre")).toMatchObject({
        address: "2, Adam Road, Singapore 289876",
        latitude: 1.324131966,
        longitude: 103.8141632,
        foodStalls: 32,
        marketStalls: 0,
      });
    });

    it("lists each quarter's cleaning as an ISO date range, dropping NEA's 'nil' remarks", () => {
      expect(byName("Adam Road Food Centre")?.closures).toEqual([
        { from: "2026-03-30", to: "2026-03-31", reason: "cleaning" },
        { from: "2026-06-08", to: "2026-06-08", reason: "cleaning" },
        { from: "2026-09-07", to: "2026-09-07", reason: "cleaning" },
        { from: "2026-12-07", to: "2026-12-08", reason: "cleaning" },
      ]);
    });

    it("leaves out closures NEA hasn't dated yet ('TBC'), and adds other works", () => {
      expect(byName("Ang Mo Kio Ave 10 Blk 409 (Teck Ghee Square)")?.closures).toEqual([
        { from: "2026-03-09", to: "2026-03-10", reason: "cleaning" },
        { from: "2026-12-14", to: "2026-12-16", reason: "cleaning" },
        { from: "2026-06-08", to: "2026-08-07", reason: "works", remarks: "Repairs and Redecoration" },
      ]);
    });

    it("keeps NEA's remarks when they say something", () => {
      const works = byName("Ang Mo Kio Ave 1 Blk 226D (Kebun Baru Market and Food Centre)")?.closures.find(
        (c) => c.reason === "works",
      );
      expect(works).toEqual({
        from: "2024-04-01",
        to: "2024-05-31",
        reason: "works",
        remarks: "Repairs and Redecoration",
      });
    });

    it("rejects a download that was cut short", () => {
      expect(() => adapter.prepare([rows.slice(0, 10)])).toThrow(/expected at least 80/);
    });
  });
});

describe("neaDate", () => {
  it("reads NEA's d/m/yyyy dates as yyyy-mm-dd", () => {
    expect(neaDate("30/3/2026")).toBe("2026-03-30");
    expect(neaDate(" 7/9/2026 ")).toBe("2026-09-07");
    expect(neaDate("14/12/2026")).toBe("2026-12-14");
  });

  it("has no date for 'NA', 'TBC' or anything else", () => {
    for (const v of ["NA", "TBC", "", "2026-03-30", "30-3-2026"]) expect(neaDate(v)).toBeUndefined();
  });

  it("rejects dates that don't exist instead of rolling them over (31 Feb is not 3 Mar)", () => {
    expect(neaDate("31/2/2026")).toBeUndefined();
    expect(neaDate("1/13/2026")).toBeUndefined();
  });
});
