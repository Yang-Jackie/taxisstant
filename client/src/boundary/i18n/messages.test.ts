// Package 9b tests — the app's words in English and Chinese (FR-2.1.2). The types make zh.ts have every key of en.ts;
// these check what types can't: no Chinese is missing, and both fill in the same {{blanks}}.
import { describe, expect, it } from "vitest";
import { en } from "./en";
import { i18next } from "./index";
import { zh } from "./zh";

/** Every message by its key, e.g. "toast.noHotspots" → "No stations are crowded right now.". */
function flatten(messages: object, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (Array.isArray(value)) value.forEach((v: string, i) => out.set(`${path}.${i}`, v));
    else for (const [k, v] of flatten(value as object, path)) out.set(k, v);
  }
  return out;
}
const blanks = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

const english = flatten(en);
const chinese = flatten(zh);

/** Words that are the same in both: names, and things written in their own language. */
const SAME = new Set(["app.name", "language.EN", "language.ZH", "language.short.EN", "language.short.ZH"]);

describe("the app's messages", () => {
  it("has a Chinese message for every English one, and no more", () => {
    expect([...chinese.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("translates everything but names", () => {
    const untranslated = [...english].filter(([k, text]) => !SAME.has(k) && chinese.get(k) === text).map(([k]) => k);
    expect(untranslated).toEqual([]);
    for (const [k, text] of chinese) expect(text.trim(), k).not.toBe("");
  });

  it("fills in the same blanks in both languages", () => {
    for (const [k, text] of english) expect(blanks(chinese.get(k)!), k).toEqual(blanks(text));
  });

  it("counts in English (1 lot, 2 lots) and not in Chinese, which has one form", () => {
    const enT = i18next.getFixedT("en");
    const zhT = i18next.getFixedT("zh");
    expect([enT("place.lotsFree", { count: 1 }), enT("place.lotsFree", { count: 2 })]).toEqual([
      "1 lot free",
      "2 lots free",
    ]);
    expect([zhT("place.lotsFree", { count: 1 }), zhT("place.lotsFree", { count: 2 })]).toEqual([
      "1 个空位",
      "2 个空位",
    ]);
    expect([enT("summary.emptyTaxis", { count: 0 }), zhT("summary.emptyTaxis", { count: 0 })]).toEqual([
      "no empty taxis nearby",
      "附近没有空德士",
    ]);
  });

  it("uses Singapore's words: 德士 for taxi and 小贩中心 for hawker centre", () => {
    expect(zh.layers.TAXI_STAND).toContain("德士");
    expect(zh.layers.HAWKER).toBe("小贩中心");
  });
});
