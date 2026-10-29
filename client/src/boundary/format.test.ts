// Package 7 tests — how times and distances read on screen.
import { describe, expect, it } from "vitest";
import { clock, distance, shortDate } from "./format";
import { i18next } from "./i18n";

const en = i18next.getFixedT("en");
const zh = i18next.getFixedT("zh");

describe("distance", () => {
  it("says metres to the nearest 10 below a kilometre", () => {
    expect([distance(4, en), distance(196, en), distance(994, en)]).toEqual(["0 m", "200 m", "990 m"]);
  });

  it("says kilometres with one decimal from a kilometre on", () => {
    expect([distance(996, en), distance(1240, en), distance(2907, en)]).toEqual(["1.0 km", "1.2 km", "2.9 km"]);
  });

  it("says 米 and 公里 in Chinese", () => {
    expect([distance(196, zh), distance(1240, zh)]).toEqual(["200 米", "1.2 公里"]);
  });
});

describe("clock", () => {
  it("tells Singapore time, whatever the phone's time zone (tests run in Los Angeles)", () => {
    expect(clock.format(new Date("2026-10-29T13:05:00Z"))).toBe("21:05");
  });
});

describe("shortDate", () => {
  it("is '7 Dec' in English and '12月7日' in Chinese, Singapore's day whatever the phone's time zone", () => {
    expect([shortDate("2026-12-07", "en"), shortDate("2026-12-07", "zh")]).toEqual(["7 Dec", "12月7日"]);
  });
});
