// Package 2a tests — parseRows: skip a few bad rows from a provider, but reject a dataset that looks wrong as a whole.
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseRows, uniqueBy } from "./parseRows.js";

const Row = z.object({ id: z.string(), lat: z.number() });
const good = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `R${i}`, lat: 1.3 }));

afterEach(() => vi.restoreAllMocks());

describe("parseRows", () => {
  it("returns every row when all of them fit", () => {
    expect(parseRows(good(3), Row, { minRows: 1 })).toEqual(good(3));
  });

  it("skips a row that doesn't fit, warning which field was wrong, and keeps the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = [...good(99), { id: "BAD", lat: "1.3" }];

    expect(parseRows(rows, Row, { minRows: 1 })).toHaveLength(99);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Skipped 1 of 100 rows.*lat/));
  });

  it("rejects the whole dataset when more than 5% of rows don't fit: the provider changed its format", () => {
    const rows = [...good(90), ...Array.from({ length: 10 }, () => ({ id: 1 }))];
    expect(() => parseRows(rows, Row, { minRows: 1 })).toThrow(/10 of 100 rows don't fit/);
  });

  it("takes a different share of bad rows when told to", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = [...good(90), ...Array.from({ length: 10 }, () => ({ id: 1 }))];
    expect(parseRows(rows, Row, { minRows: 1, maxInvalidShare: 0.2 })).toHaveLength(90);
  });

  it("rejects a download that is too small to be real (cut short, or emptied)", () => {
    expect(() => parseRows(good(5), Row, { minRows: 100 })).toThrow(/only 5 rows; expected at least 100/);
    expect(() => parseRows([], Row, { minRows: 1 })).toThrow(/only 0 rows/);
  });

  it("rejects something that isn't a list of rows", () => {
    expect(() => parseRows({ value: [] }, Row, { minRows: 0 })).toThrow();
  });
});

describe("uniqueBy", () => {
  it("keeps the first item for each key, in order", () => {
    const items = [
      { id: "A", n: 1 },
      { id: "B", n: 2 },
      { id: "A", n: 3 },
    ];
    expect(uniqueBy(items, (i) => i.id)).toEqual([
      { id: "A", n: 1 },
      { id: "B", n: 2 },
    ]);
  });
});
