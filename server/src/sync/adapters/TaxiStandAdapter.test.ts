// M3 acceptance tests — TaxiStandAdapter «adapter»: declares where taxi stands come from, and turns
// LTA's raw rows into the server's own TaxiStandDto shape, rejecting anything that doesn't fit.
// Uses a real LTA DataMall response, recorded on 26 Oct 2026 (316 stands).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaxiStandAdapter } from "./TaxiStandAdapter.js";

const recorded = JSON.parse(
  readFileSync(new URL("../../sample-data/lta-taxi-stands.raw.json", import.meta.url), "utf8"),
) as { value: Record<string, unknown>[] };

/** The adapter receives the rows (the facade already unwrapped LTA's { value: [...] } envelope). */
const rows = recorded.value;

/** A copy of the first real row with some fields changed — for testing bad data. */
function rowWith(changes: Record<string, unknown>) {
  return { ...rows[0], ...changes };
}

describe("TaxiStandAdapter", () => {
  const adapter = new TaxiStandAdapter();

  describe("declares its own data source", () => {
    it("feeds the TAXI_STANDS dataset", () => expect(adapter.getDataset()).toBe("TAXI_STANDS"));
    it("comes from LTA DataMall", () => expect(adapter.getSource()).toBe("LTA_DATAMALL"));
    it("lives at /TaxiStands", () => expect(adapter.getPaths()).toEqual(["/TaxiStands"]));
    it("refreshes once a day (static data, D1)", () => expect(adapter.getRefreshInterval()).toBe(24 * 60 * 60 * 1000));
  });

  describe("prepare()", () => {
    it("turns every real LTA row into a TaxiStandDto", () => {
      expect(adapter.prepare([rows])).toHaveLength(316);
    });

    it("renames and converts the fields", () => {
      expect(adapter.prepare([rows])[0]).toEqual({
        id: "A01",
        name: "Orchard Rd along driveway of Lucky Plaza",
        latitude: 1.304294727,
        longitude: 103.8338467,
        standType: "Stand",
        isBarrierFree: true, // from Bfa: "Yes"
      });
    });

    it('turns Bfa "No" into isBarrierFree: false', () => {
      const noBfa = rows.findIndex((r) => r["Bfa"] === "No");
      expect(adapter.prepare([rows])[noBfa]?.isBarrierFree).toBe(false);
    });

    it("keeps only the six fields the app uses (drops Ownership)", () => {
      for (const dto of adapter.prepare([rows])) {
        expect(Object.keys(dto).sort()).toEqual(["id", "isBarrierFree", "latitude", "longitude", "name", "standType"]);
      }
    });

    it("rejects the whole { value: [...] } envelope — it expects the rows", () => {
      expect(() => adapter.prepare([recorded])).toThrow();
    });

    // Package 2a (D16): one bad row is skipped instead of freezing the whole layer.
    describe("a row that doesn't fit is skipped, and the other 315 kept", () => {
      const withBad = (bad: Record<string, unknown>) => [bad, ...rows.slice(1)];
      const keptIds = (input: unknown[]) => adapter.prepare([input]).map((s) => s.id);

      beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
      });
      afterEach(() => vi.restoreAllMocks());

      it("a row with a missing field", () => {
        const { Name: _dropped, ...noName } = rows[0] as Record<string, unknown>;
        const ids = keptIds(withBad(noName));
        expect(ids).toHaveLength(315);
        expect(ids).not.toContain("A01");
      });

      it("a latitude sent as text instead of a number", () => {
        expect(keptIds(withBad(rowWith({ Latitude: "1.3043" })))).not.toContain("A01");
      });

      it("a Bfa value it can't turn into true/false", () => {
        expect(keptIds(withBad(rowWith({ Bfa: "Maybe" })))).not.toContain("A01");
      });
    });

    it("rejects the whole dataset when many rows don't fit: LTA changed its format", () => {
      const renamed = rows.map((r) => ({ ...r, Latitude: undefined, Lat: r["Latitude"] }));
      expect(() => adapter.prepare([renamed])).toThrow(/don't fit/);
    });

    it("rejects a download that was cut short", () => {
      expect(() => adapter.prepare([rows.slice(0, 50)])).toThrow(/expected at least 200/);
    });
  });
});
