import type { TFunction } from "i18next";

/** Hours and minutes in Singapore time, e.g. "20:50", whatever time zone the phone is set to; the same in both languages. */
export const clock = new Intl.DateTimeFormat("en-SG", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Singapore",
});

const shortDates = new Map<string, Intl.DateTimeFormat>();

/** A day as "7 Dec" in English or "12月7日" in Chinese, in Singapore's calendar. `isoDate` is e.g. "2026-12-07". */
export function shortDate(isoDate: string, language: string): string {
  const locale = language.startsWith("zh") ? "zh-SG" : "en-SG";
  let format = shortDates.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Asia/Singapore" });
    shortDates.set(locale, format);
  }
  return format.format(new Date(`${isoDate}T00:00:00+08:00`));
}

/** A distance as a driver reads it: "350 m" to the nearest 10 m, or "1.2 km" from a kilometre on (米, 公里 in Chinese). */
export function distance(metres: number, t: TFunction): string {
  const rounded = Math.round(metres / 10) * 10;
  return rounded < 1000 ? t("units.metres", { n: rounded }) : t("units.kilometres", { n: (metres / 1000).toFixed(1) });
}
